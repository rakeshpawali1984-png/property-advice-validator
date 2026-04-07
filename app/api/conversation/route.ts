import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ALL_QUESTION_IDS, ALL_PROPERTY_QUESTION_IDS, CATEGORIES, PROPERTY_CATEGORIES } from '@/lib/questions'
import { OptionScore } from '@/lib/types'

// ─── Deterministic property scoring (property mode only) ──────────────────────
// Produces score overrides for Financial Viability and Risk Factor questions
// from hard numbers in the conversation text, matching the property engine spec.
function computeDeterministicPropertyPrefills(text: string): Record<string, OptionScore> {
  const out: Record<string, OptionScore> = {}
  const cleaned = text.replace(/,/g, '')

  // --- Yield computation ---------------------------------------------------
  let priceNum: number | undefined
  const pricePatterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/\$\s*([\d]+(?:\.\d+)?)\s*(?:million|m)\b/i, (m) => parseFloat(m[1]) * 1_000_000],
    [/\$\s*([\d]+)\s*k\b/i, (m) => parseFloat(m[1]) * 1_000],
    [/(?:purchase\s+price|listed?\s+(?:at|for)|asking\s+(?:price|at|for)|priced?\s+at)\s*:?\s*\$?\s*([\d]{5,})/i, (m) => parseFloat(m[1])],
    [/\$\s*([\d]{5,})\b/, (m) => parseFloat(m[1])],
  ]
  for (const [pat, convert] of pricePatterns) {
    const m = cleaned.match(pat)
    if (m) { const v = convert(m); if (v >= 50_000 && v <= 20_000_000) { priceNum = v; break } }
  }

  let rentMid: number | undefined
  const rentRange = cleaned.match(/\$\s*(\d{3,})\s*[-\u2013]\s*\$?\s*(\d{3,})\s*(?:per\s*week|pw|\/week|\/wk)?/i)
  if (rentRange) {
    const lo = parseFloat(rentRange[1])
    const hi = parseFloat(rentRange[2])
    if (lo >= 100 && hi >= lo && hi <= 5_000) rentMid = (lo + hi) / 2
  }
  if (!rentMid) {
    const single = cleaned.match(/\$\s*(\d{3,})\s*(?:per\s*week|pw|\/week|\/wk)/i)
    if (single) { const v = parseFloat(single[1]); if (v >= 100 && v <= 5_000) rentMid = v }
  }

  if (priceNum && rentMid) {
    const yieldPct = (rentMid * 52 / priceNum) * 100
    // ≥6% → 10 (Strong), 4–5.99% → 6 (Moderate), <4% → 2 (Poor)
    const yieldScore: OptionScore = yieldPct >= 6 ? 10 : yieldPct >= 4 ? 6 : 2
    out['pf_1'] = yieldScore  // "Is the stated rental yield supported..."
  }

  // --- Risk factor deductions (spec: start at 10, subtract per flag) --------
  let riskDed = 0
  if (/public\s*housing|housing\s*commission|commission\s*home/i.test(text)) riskDed += 2
  if (/transmission\s*line|power\s*lines?|high[- ]?voltage|pylon/i.test(text)) riskDed += 2
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) riskDed += 1
  if (/steep\s*slope|sloped?\s*(?:land|block)|sloping/i.test(text)) riskDed += 1
  const yrMatch = text.match(/(?:built|constructed|circa)\s*(?:in\s+)?(\d{4})\b/i)
  if (yrMatch && (new Date().getFullYear() - parseInt(yrMatch[1])) > 40) riskDed += 1

  const riskRaw = Math.max(0, 10 - riskDed)
  const riskScore: OptionScore = riskRaw >= 8 ? 10 : riskRaw >= 5 ? 6 : 2
  out['pr_1'] = riskScore  // environmental risks question
  out['pr_2'] = riskScore  // external risks question

  // --- Asset quality deductions (spec: start at 10, subtract per flag) -----
  let assetDed = 0
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) assetDed += 1
  if (yrMatch && (new Date().getFullYear() - parseInt(yrMatch[1])) > 40) assetDed += 1
  // "poor layout" is subjective — leave pa_1 to LLM; only pre-fill land characteristics
  const assetRaw = Math.max(0, 10 - assetDed)
  const assetScore: OptionScore = assetRaw >= 8 ? 10 : assetRaw >= 5 ? 6 : 2
  out['pa_2'] = assetScore  // land characteristics question

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
    for (const [id, score] of Object.entries(parsed.prefills ?? {})) {
      if (validIds.includes(id) && validScores.includes(score as OptionScore)) {
        safePrefills[id] = score as OptionScore
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
    })
  } catch (err) {
    console.error('Conversation analyze error:', err)
    return NextResponse.json({ error: 'Failed to analyze conversation' }, { status: 500 })
  }
}

