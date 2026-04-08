import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ALL_PROPERTY_QUESTION_IDS, PROPERTY_CATEGORIES } from '@/lib/questions'
import { OptionScore, PropertyData } from '@/lib/types'

// ─── URL scraper (best-effort) ────────────────────────────────────────────────
async function tryFetchUrl(url: string): Promise<{ text: string; ok: boolean }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return { text: '', ok: false }
    const html = await res.text()
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000)
    return { text: stripped, ok: stripped.length > 100 }
  } catch {
    return { text: '', ok: false }
  }
}

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
    const body = await req.json() as { addressOrUrl?: string; listingText?: string }
    const { addressOrUrl, listingText } = body

    if (!addressOrUrl || addressOrUrl.trim().length < 5) {
      return NextResponse.json({ error: 'Please enter a property address or URL.' }, { status: 400 })
    }

    // Try to scrape URL first
    let scrapedText = ''
    let scrapedOk = false
    if (/^https?:\/\//i.test(addressOrUrl.trim())) {
      const result = await tryFetchUrl(addressOrUrl.trim())
      scrapedText = result.text
      scrapedOk = result.ok
    }

    const combinedText = [
      `Property address or URL: ${addressOrUrl.trim()}`,
      scrapedText ? `\n\nFetched page content:\n${scrapedText}` : '',
      listingText?.trim() ? `\n\nListing details (user-provided):\n${listingText.slice(0, 3000)}` : '',
    ].join('')

    const questionList = PROPERTY_CATEGORIES.flatMap((cat) =>
      cat.questions.map((q) => ({
        id: q.id,
        category: cat.name,
        question: q.text,
      }))
    )

    const prompt = `You are analysing a property listing to assess deal quality for an Australian residential real estate buyer.

${combinedText}

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
- flags (array of brief risk descriptors — only real risks, e.g. ["Flood overlay", "High-voltage powerline nearby"])

TASK 2 — Score each question below based ONLY on what is explicitly evident in the listing. If there is no evidence for a question, omit it.

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
  "summary": "2-3 sentence analysis of this property's key attributes, investment appeal, and any notable risks."
}

Use scores 10, 6, or 2 only. If very little data is available, still return your best estimates from the address context.`

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
      const cleanFlags = rawPd.flags.filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      if (cleanFlags.length > 0) propertyData.flags = cleanFlags
    }

    return NextResponse.json({
      prefills: safePrefills,
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
      rawText: combinedText,
      propertyData,
      scrapedOk,
    })
  } catch (err) {
    console.error('Property extract error:', err)
    return NextResponse.json({ error: 'Failed to extract property details.' }, { status: 500 })
  }
}
