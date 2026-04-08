import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ALL_PROPERTY_QUESTION_IDS, PROPERTY_CATEGORIES } from '@/lib/questions'
import { OptionScore, PropertyData } from '@/lib/types'

// ─── Deterministic property scoring (mirrors conversation/route.ts) ───────────
function computeDeterministicPropertyPrefills(text: string): Record<string, OptionScore> {
  const out: Record<string, OptionScore> = {}

  const yrMatch = text.match(/(?:built|constructed|circa)\s*(?:in\s+)?(\d{4})\b/i)
  const buildAge = yrMatch ? new Date().getFullYear() - parseInt(yrMatch[1]) : 0

  // pr_1: environmental / physical risks
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

  // pr_2: external / infrastructure risks
  let extDed = 0
  if (/public\s*housing|housing\s*commission|commission\s*home/i.test(text)) extDed += 2
  if (/transmission\s*line|power\s*lines?|high[- ]?voltage|pylon/i.test(text)) extDed += 2
  if (/strata\s*(?:title|levy|fees?)?|body\s*corporate|owners?\s*corp(?:oration)?/i.test(text)) extDed += 1
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) extDed += 1
  const extRaw = Math.max(0, 10 - extDed)
  out['pr_2'] = (extRaw >= 8 ? 10 : extRaw >= 5 ? 6 : 2) as OptionScore

  // pa_2: land / asset characteristics
  let assetDed = 0
  if (/irregular\s*(?:block|shape|land)|battle[-\s]?axe/i.test(text)) assetDed += 1
  if (buildAge > 40) assetDed += 1
  const assetRaw = Math.max(0, 10 - assetDed)
  out['pa_2'] = (assetRaw >= 8 ? 10 : assetRaw >= 5 ? 6 : 2) as OptionScore

  return out
}

const PD_STRING_FIELDS = [
  'address', 'price', 'landSize', 'yearBuilt',
  'bedrooms', 'bathrooms', 'parking', 'rentRange', 'estimatedYield',
] as const

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const body = await req.json() as { listingText?: string }
    const { listingText } = body

    if (!listingText || listingText.trim().length < 10) {
      return NextResponse.json({ error: 'Please paste some property details to analyse.' }, { status: 400 })
    }

    const combinedText = listingText.trim().slice(0, 5000)

    // Extract lines where the user explicitly states something is NOT a risk
    const clearedRisks = combinedText
      .split(/[\n;]+/)
      .map(l => l.trim())
      .filter(l => l.length > 3 && l.length < 200 && /\b(no|not|without|never|none|free\s+from)\b/i.test(l))

    const questionList = PROPERTY_CATEGORIES.flatMap((cat) =>
      cat.questions.map((q) => ({
        id: q.id,
        category: cat.name,
        question: q.text,
      }))
    )

    const clearedSection = clearedRisks.length > 0
      ? `\nEXPLICITLY CLEARED — the user confirmed these are NOT risks. You MUST NOT include them as flags under any circumstances:\n${clearedRisks.map(c => `  • "${c}"`).join('\n')}\n`
      : ''

    const prompt = `You are analysing a property listing to assess deal quality for an Australian residential real estate buyer.

${combinedText}
${clearedSection}
TASK 1 — Extract the following property facts (omit any field for which no evidence exists):
- address (full address if identifiable)
- price (asking price, e.g. "$850,000")
- landSize (land area, e.g. "420m²")
- yearBuilt (e.g. "1985" or "circa 1960s")
- bedrooms (number as string, e.g. "3")
- bathrooms (number as string, e.g. "2")
- parking (number as string, e.g. "1")
- rentRange (weekly rent if available, e.g. "$450–$480/wk")
- estimatedYield (gross yield if calculable, e.g. "3.2%")
- flags (array of brief risk descriptors — ONLY include a risk when the text CONFIRMS it as a fact. Any item listed in EXPLICITLY CLEARED above must never appear here. Absence of mention is not a flag. When in doubt, omit.)

TASK 2 — Score each question below based ONLY on what is explicitly stated in the listing text.

CRITICAL SCORING RULES — read carefully:
- Score 10: The listing explicitly provides positive evidence (e.g. building inspection done, comparable sales cited, independent yield source named).
- Score 6: The topic is mentioned in general or partial terms, OR the listing does not address it at all. A typical property listing will not contain independent research, inspections, or risk checks — that is NORMAL, not a failing. Missing = 6 (unknown/unverified, not bad).
- Score 2: ONLY use this when the listing explicitly states a problem or confirms something negative (e.g. "sold as-is", "no building inspection", stated flood overlay, confirmed heritage restriction, strata with known issues).

If you are not sure, omit the question entirely — do NOT guess or infer negatively. Omitting is better than a wrong score 2.

Questions:
${questionList.map((q) => `- ID: ${q.id} | ${q.category}: ${q.question}`).join('\n')}

Respond ONLY with valid JSON in this exact format:
{
  "propertyData": {
    "address": "...",
    "price": "...",
    "landSize": "...",
    "yearBuilt": "...",
    "bedrooms": "...",
    "bathrooms": "...",
    "parking": "...",
    "rentRange": "...",
    "estimatedYield": "...",
    "flags": ["..."]
  },
  "prefills": { "question_id": score_number },
  "summary": "2-3 sentence analysis of this property's key attributes, investment appeal, and any explicitly stated risks or strengths."
}

Use scores 10, 6, or 2 only. Omit questions where the listing gives no clear signal either way.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
    })

    const raw = completion.choices[0].message.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and filter prefills
    const validScores: OptionScore[] = [10, 6, 2]
    const safePrefills: Record<string, OptionScore> = {}
    for (const [id, score] of Object.entries(parsed.prefills ?? {})) {
      if (ALL_PROPERTY_QUESTION_IDS.includes(id) && validScores.includes(score as OptionScore)) {
        safePrefills[id] = score as OptionScore
      }
    }

    // Deterministic overrides always win
    const deterministic = computeDeterministicPropertyPrefills(combinedText)
    for (const [id, score] of Object.entries(deterministic)) {
      safePrefills[id] = score
    }

    // Clean propertyData — only include non-empty values
    const rawPd = (parsed.propertyData ?? {}) as Record<string, unknown>
    const propertyData: PropertyData = {}
    for (const field of PD_STRING_FIELDS) {
      const val = rawPd[field]
      if (typeof val === 'string' && val.trim()) {
        propertyData[field] = val.trim()
      }
    }
    if (Array.isArray(rawPd.flags)) {
      const cleanFlags = rawPd.flags.filter((f): f is string => {
        if (typeof f !== 'string' || !f.trim()) return false
        // Strip GPT-appended description (e.g. "— potential impact...")
        const coreLabel = f.split(/\s*[—–\-]\s*/)[0].trim().toLowerCase()
        const coreWords = coreLabel.replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3)
        // Check 1: does any cleared line from the input contain this flag's key words?
        for (const cleared of clearedRisks) {
          const cl = cleared.toLowerCase()
          const matchCount = coreWords.filter(w => cl.includes(w)).length
          if (matchCount >= Math.min(2, coreWords.length)) return false
        }
        // Check 2: regex negation fallback on full text
        for (const word of coreWords) {
          const negated = new RegExp(`\\b(no|not|without|never|none|free\\s+from)\\b[^.!?\\n]{0,80}${word}`, 'i')
          if (negated.test(combinedText)) return false
        }
        return true
      })
      if (cleanFlags.length > 0) propertyData.flags = cleanFlags
    }

    return NextResponse.json({
      prefills: safePrefills,
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
      rawText: combinedText,
      propertyData,
    })
  } catch (err) {
    console.error('Property extract error:', err)
    return NextResponse.json({ error: 'Failed to extract property details.' }, { status: 500 })
  }
}
