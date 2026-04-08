import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ALL_QUESTION_IDS, ALL_PROPERTY_QUESTION_IDS, CATEGORIES, PROPERTY_CATEGORIES } from '@/lib/questions'
import { OptionScore } from '@/lib/types'

// ─── Deterministic property scoring (property mode only) ──────────────────────
// Produces score overrides for Financial Viability and Risk Factor questions
// from hard numbers in the conversation text, matching the property engine spec.
function computeDeterministicPropertyPrefills(text: string): Record<string, OptionScore> {
  const out: Record<string, OptionScore> = {}

  // pf_1 (yield quality) is NOT scored deterministically — yield magnitude ≠ data quality.
  // "Is the stated yield supported by independent data?" cannot be answered from numbers alone.

  // --- Risk factor deductions — domain-split --------------------------------
  const yrMatch = text.match(/(?:built|constructed|circa)\s*(?:in\s+)?(\d{4})\b/i)
  const buildAge = yrMatch ? new Date().getFullYear() - parseInt(yrMatch[1]) : 0

  // pr_1: environmental / physical risks (flood, fire, contamination, heritage, slope, age)
  let envDed = 0
  if (/flood\s*(?:overlay|zone|plain|risk)|floodprone/i.test(text)) envDed += 2
  if (/bushfire|BAL[\s-]?rating|fire\s*(?:overlay|zone|risk)/i.test(text)) envDed += 2
  if (/(?:contaminated|contamination|remediation)\s*(?:land|soil|site)?/i.test(text)) envDed += 2
  if (/asbestos/i.test(text)) envDed += 2
  if (/heritage\s*(?:overlay|listed?|register)/i.test(text)) envDed += 1
  if (/steep\s*slope|sloped?\s*(?:land|block)|sloping/i.test(text)) envDed += 1
  if (buildAge > 40) envDed += 1
  const envRaw = Math.max(0, 10 - envDed)
  out['pr_1'] = (envRaw >= 8 ? 10 : envRaw >= 5 ? 6 : 2) as OptionScore

  // pr_2: external / infrastructure risks (power lines, housing, strata, block shape)
  let extDed = 0
  if (/public\s*housing|housing\s*commission|commission\s*home/i.test(text)) extDed += 2
  if (/transmission\s*line|power\s*lines?|high[- ]?voltage|pylon/i.test(text)) extDed += 2
  if (/strata\s*(?:title|levy|fees?)?|body\s*corporate|owners?\s*corp(?:oration)?/i.test(text)) extDed += 1
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) extDed += 1
  const extRaw = Math.max(0, 10 - extDed)
  out['pr_2'] = (extRaw >= 8 ? 10 : extRaw >= 5 ? 6 : 2) as OptionScore

  // --- Asset quality deductions (land characteristics only) -----------------
  let assetDed = 0
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) assetDed += 1
  if (buildAge > 40) assetDed += 1
  // "poor layout" is subjective — leave pa_1 to LLM; only pre-fill land characteristics
  const assetRaw = Math.max(0, 10 - assetDed)
  out['pa_2'] = (assetRaw >= 8 ? 10 : assetRaw >= 5 ? 6 : 2) as OptionScore

  return out
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { conversation, contextType } = await req.json() as { conversation: string; contextType?: 'agent' | 'property' }

    if (!conversation || conversation.trim().length < 20) {
      return NextResponse.json({ error: 'Conversation too short' }, { status: 400 })
    }

    const isProperty = contextType === 'property'
    const activeCategories = isProperty ? PROPERTY_CATEGORIES : CATEGORIES
    const validIds = isProperty ? ALL_PROPERTY_QUESTION_IDS : ALL_QUESTION_IDS

    const questionList = activeCategories.flatMap((cat) =>
      cat.questions.map((q) => ({
        id: q.id,
        category: cat.name,
        question: q.text,
        options: q.options.map((o) => `${o.score}: "${o.label}"`).join(', '),
      }))
    )

    const contextLabel = isProperty
      ? 'a property recommendation to assess deal quality'
      : "a buyer's agent discussion to assess the agent's quality"

    const prompt = `You are analysing a conversation about ${contextLabel}.

Conversation:
"""
${conversation.slice(0, 4000)}
"""

Based ONLY on what is explicitly evident in the conversation, map each question below to the most appropriate score (10 = Best, 6 = Medium, 2 = Poor). If there is no evidence for a question, omit it.

Questions:
${questionList.map((q) => `- ID: ${q.id} | ${q.category}: ${q.question}`).join('\n')}

Respond ONLY with valid JSON in this exact format:
{
  "prefills": {
    "question_id": score_number
  },
  "summary": "2-3 sentence summary of what the conversation reveals about ${isProperty ? 'this property and its suitability' : 'this agent'}."
}

Only include question IDs where the conversation provides clear evidence. Use scores 10, 6, or 2 only.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    })

    const raw = completion.choices[0].message.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const parsed = JSON.parse(jsonMatch[0])

    // Validate prefills — only allow valid question IDs and valid scores
    const validScores: OptionScore[] = [10, 6, 2]
    const safePrefills: { [k: string]: OptionScore } = {}
    let rejectedCount = 0
    for (const [id, score] of Object.entries(parsed.prefills ?? {})) {
      if (validIds.includes(id) && validScores.includes(score as OptionScore)) {
        safePrefills[id] = score as OptionScore
      } else {
        rejectedCount++
        console.warn(`[conversation] Rejected prefill: ${id}=${score}`)
      }
    }

    // For property mode, merge in deterministic overrides (hard math beats LLM inference)
    if (isProperty) {
      const deterministic = computeDeterministicPropertyPrefills(conversation)
      for (const [id, score] of Object.entries(deterministic)) {
        safePrefills[id] = score  // deterministic always wins
      }
    }

    return NextResponse.json({
      prefills: safePrefills,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      rejectedCount,
    })
  } catch (err) {
    console.error('Conversation analyze error:', err)
    return NextResponse.json({ error: 'Failed to analyze conversation' }, { status: 500 })
  }
}

