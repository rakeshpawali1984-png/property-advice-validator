import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { CategoryScore, PropertyData } from '@/lib/types'

// ─── Promotional language detection ───────────────────────────────────────────
const PROMO_PHRASES: { pattern: RegExp; label: (m: string) => string }[] = [
  { pattern: /off[- ]?market/i, label: (m) => `"${m}" used — sourcing and developer relationship not independently verified` },
  { pattern: /great opportunity|rare opportunity|once[- ]in[- ]a[- ]lifetime/i, label: (m) => `"${m}" — promotional framing without supporting evidence` },
  { pattern: /everyone is buying|everyone['\u2019]?s buying|people are snapping/i, label: (m) => `"${m}" — social-pressure language substituting for market data` },
  { pattern: /trust me|you can rely on me|i guarantee/i, label: (m) => `"${m}" — personal assurance used in place of verifiable evidence` },
  { pattern: /can'?t go wrong|no[- ]brainer|sure thing|always goes up/i, label: (m) => `"${m}" — absolute performance claim without qualifying data` },
  { pattern: /developer partner|working with the developer/i, label: (m) => `"${m}" — potential developer relationship; incentive structure unverified` },
  { pattern: /safe suburb|always in demand|strong growth area/i, label: (m) => `"${m}" — qualitative location claim without independent data` },
]

function detectPromoSignals(text: string): string[] {
  if (!text || text.trim().length < 10) return []
  return PROMO_PHRASES
    .filter(({ pattern }) => pattern.test(text))
    .map(({ pattern, label }) => {
      const match = text.match(pattern)
      return label(match ? match[0] : '')
    })
}

// ─── Property intelligence — server-side extraction ───────────────────────────
interface RawPropertyIntel {
  data: PropertyData
  priceNum?: number
  rentMidpoint?: number
}

function extractPropertyIntel(text: string): RawPropertyIntel {
  if (!text || text.trim().length < 20) return { data: {} }
  const cleaned = text.replace(/,/g, '')
  const data: PropertyData = {}
  let priceNum: number | undefined
  let rentMidpoint: number | undefined

  // Price — try patterns from most specific to least
  const pricePatterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/\$\s*([\d]+(?:\.\d+)?)\s*(?:million|m)\b/i, (m) => parseFloat(m[1]) * 1_000_000],
    [/\$\s*([\d]+)\s*k\b/i, (m) => parseFloat(m[1]) * 1_000],
    [/(?:purchase\s+price|listed?\s+(?:at|for)|asking\s+(?:price|at|for)|priced?\s+at)\s*:?\s*\$?\s*([\d]{5,})/i, (m) => parseFloat(m[1])],
    [/\$\s*([\d]{5,})\b/, (m) => parseFloat(m[1])],
  ]
  for (const [pat, convert] of pricePatterns) {
    const m = cleaned.match(pat)
    if (m) {
      const val = convert(m)
      if (val >= 50_000 && val <= 20_000_000) {
        priceNum = val
        data.price = `$${Math.round(val).toLocaleString('en-AU')}`
        break
      }
    }
  }

  // Rent range — try range first, then single figure
  const rentRange = cleaned.match(/\$\s*(\d{3,})\s*[-\u2013]\s*\$?\s*(\d{3,})\s*(?:per\s*week|pw|\/week|\/wk)?/i)
    ?? cleaned.match(/rent(?:al)?[^.]{0,30}?\$\s*(\d{3,})\s*[-\u2013]\s*\$?\s*(\d{3,})/i)
  if (rentRange) {
    const lo = parseFloat(rentRange[1])
    const hi = parseFloat(rentRange[2])
    if (lo >= 100 && hi >= lo && hi <= 5_000) {
      rentMidpoint = (lo + hi) / 2
      data.rentRange = `$${lo}\u2013$${hi}/week`
    }
  }
  if (!rentMidpoint) {
    const single = cleaned.match(/\$\s*(\d{3,})\s*(?:per\s*week|pw|\/week|\/wk)/i)
    if (single) {
      const val = parseFloat(single[1])
      if (val >= 100 && val <= 5_000) { rentMidpoint = val; data.rentRange = `$${val}/week` }
    }
  }

  // Yield — computed precisely from extracted figures
  if (priceNum && rentMidpoint) {
    const yld = (rentMidpoint * 52 / priceNum) * 100
    data.estimatedYield = `~${yld.toFixed(1)}%`
  }

  // Land size
  const land = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:m[²2]|sqm|square\s*m(?:etre)?s?)\b/i)
  if (land) data.landSize = `${land[1]}m\u00B2`

  // Year built
  const yr = text.match(/(?:built|constructed|circa|c\.)\s*(?:in\s+)?(\d{4})\b/i)
    ?? text.match(/\b(\d{4})\s*(?:build|construction|era|built)\b/i)
  if (yr) data.yearBuilt = yr[1]

  // Property risk flags from keywords
  const flagDefs: { pattern: RegExp; label: string }[] = [
    { pattern: /public\s*housing|housing\s*commission|commission\s*home/i, label: 'Public housing nearby — potential impact on tenant quality and resale liquidity' },
    { pattern: /(?:high[- ]?voltage\s+|transmission\s+|overhead\s+)?power\s*lines?|transmission\s*line|electricity\s*easement|pylons?/i, label: 'Transmission or high-voltage power lines present — perception risk and property value discount' },
    { pattern: /flood\s*(?:overlay|zone|plain|risk)|floodprone/i, label: 'Flood overlay — insurance costs elevated; some lenders apply restrictions' },
    { pattern: /bushfire|BAL[\s-]?rating|fire\s*(?:overlay|zone|risk)/i, label: 'Bushfire risk overlay — construction standards and insurance premiums affected' },
    { pattern: /steep\s*slope|significant\s*slope|sloped?\s*(?:land|block|site)/i, label: 'Sloped land — site works and landscaping costs above standard' },
    { pattern: /irregular\s*(?:block|shape|land)|battle[-\s]?axe/i, label: 'Irregular or battle-axe block — subdivision and development potential restricted' },
    { pattern: /strata\s*(?:title|levy|fees?)?|body\s*corporate|owners?\s*corp(?:oration)?/i, label: 'Strata/owners corporation — ongoing levies and collective decision-making constraints' },
    { pattern: /asbestos/i, label: 'Asbestos indicated — remediation costs and mandatory buyer disclosure apply' },
    { pattern: /heritage\s*(?:overlay|listed?|register)/i, label: 'Heritage overlay — renovation approvals restricted by council' },
    { pattern: /(?:contaminated|contamination|remediation)\s*(?:land|soil|site)?/i, label: 'Land contamination risk — remediation liability and lender restrictions may apply' },
  ]
  const flags: string[] = []
  for (const { pattern, label } of flagDefs) {
    if (pattern.test(text)) flags.push(label)
  }
  // Age-derived flags
  if (data.yearBuilt) {
    const yearNum = parseInt(data.yearBuilt)
    if (yearNum < 1960) flags.push('Pre-1960 construction — asbestos testing, heritage overlay check, and full structural assessment required')
    else if (yearNum < 1985) flags.push(`${data.yearBuilt} construction — electrical wiring and plumbing inspection recommended before settlement`)
  }
  if (flags.length > 0) data.flags = flags

  return { data, priceNum, rentMidpoint }
}

function buildPropertyIntelBlock(intel: RawPropertyIntel, promoSignals: string[]): string {
  const { data } = intel
  const lines: string[] = []
  const hasData = data.price || data.rentRange || data.landSize || data.yearBuilt || (data.flags && data.flags.length > 0)

  if (hasData) {
    lines.push('\nExtracted property data (derive property-specific risks, strengths, executive summary, and verification steps from this):')
    if (data.price) lines.push(`- Purchase price: ${data.price}`)
    if (data.rentRange) lines.push(`- Rental estimate: ${data.rentRange}`)
    if (data.estimatedYield) lines.push(`- Computed rental yield: ${data.estimatedYield}`)
    if (data.landSize) lines.push(`- Land size: ${data.landSize}`)
    if (data.yearBuilt) lines.push(`- Year built: ${data.yearBuilt}`)
    if (data.flags && data.flags.length > 0) {
      lines.push('- Property risk flags:')
      data.flags.forEach(f => lines.push(`  * ${f}`))
    }
  }
  if (promoSignals.length > 0) {
    lines.push('\nLanguage signals detected in conversation:')
    promoSignals.forEach(s => lines.push(`- ${s}`))
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { categoryScores, weakAreas, verdict, finalScore, contextType, conversationText, riskLevel } = await req.json() as {
      categoryScores: CategoryScore[]
      weakAreas: string[]
      verdict: string
      finalScore: number
      contextType?: 'agent' | 'property'
      conversationText?: string
      riskLevel?: 'Low' | 'Moderate' | 'Elevated'
    }

    const scoreSummary = categoryScores
      .filter((c) => c.answered)
      .map((c) => `${c.name}: ${(c.score).toFixed(1)}/10 (weight ${(c.weight * 100).toFixed(0)}%)`)
      .join(', ')

    const text = conversationText ?? ''
    const promoSignals = detectPromoSignals(text)
    const propertyIntel = extractPropertyIntel(text)
    const propBlock = buildPropertyIntelBlock(propertyIntel, promoSignals)
    const hasPropertyData = !!propBlock.trim()

    const contextLabel = contextType === 'property' ? 'a property recommendation' : 'an initial agent discussion'
    const contextWeightNote = contextType === 'property'
      ? 'Asset quality, financial viability, risk factors, location demand, and evidence quality carry weight.'
      : 'Strategy fit, data evidence, risk discussion depth, professionalism, incentive transparency, and track record carry weight.'

    // ─── Engine-specific prompt rules ─────────────────────────────────────────
    // Agent engine: advice credibility audit — NO yield, NO asset quality content.
    // Property engine: deal quality audit — NO agent credibility content.

    const strengthsRule = contextType === 'property'
      ? (finalScore < 60
          ? 'strengths: maximum 2. Derive ONLY from confirmed property attributes (computed yield, land size, absence of overlays, favourable location). Do NOT mention agent credibility, professionalism, or track record.'
          : 'strengths: maximum 3. Include computed yield if ≥6%, clean risk profile if no flags detected, strong location evidence if supported. No agent-related content.')
      : (finalScore < 60
          ? 'strengths: maximum 2. List only what the agent explicitly demonstrated (e.g. clear strategy alignment, responsive communication). Do NOT invent. No yield, no asset quality content.'
          : 'strengths: maximum 3. Derive from categories that scored above 7/10. Focus: strategy alignment, data quality, disclosure completeness, professional conduct. No property-specific content (no yield, no physical asset attributes).')

    const risksRule = contextType === 'property'
      ? (hasPropertyData
          ? 'risks: up to 4. Property-specific risks ONLY: list yield shortfall, detected environmental or external flags, age/construction concerns, location weaknesses — in that order by severity. Do NOT include agent credibility gaps.'
          : 'risks: up to 4. Focus on evidence gaps — missing price benchmarking, unverified yield claims, undisclosed risk factors, missing location substantiation.')
      : 'risks: up to 4. Agent-credibility risks ONLY: advice gaps, missing data, undisclosed incentives, risk discussion absences, pressure tactics detected. Do NOT calculate or estimate yield. Do NOT mention physical asset risks.'

    const nextStepsRule = contextType === 'property'
      ? (hasPropertyData
          ? 'nextSteps: exactly 3. Each step must tie to a specific detected property risk or data gap — not generic. Example: "Commission a building and pest inspection given the 1978 construction date", "Verify flood overlay with council before exchange", "Obtain independent vacancy rate data from a third-party source".'
          : 'nextSteps: exactly 3. Focus on verifying property data: independent rental comparables, price benchmarking, environmental overlay check.')
      : 'nextSteps: exactly 3. Each step must verify the agent\'s advice quality: "Request written disclosure of all referral arrangements", "Obtain comparable sales data for the recommended suburb from an independent source", "Ask for documented risk scenarios including vacancy and rate sensitivity".'

    const execSummaryInstruction = contextType === 'property'
      ? '2–3 direct sentences: (1) deal quality verdict with yield if computed, (2) most significant property risk by name, (3) key missing evidence element.'
      : '2–3 direct sentences: (1) advice quality verdict naming the strongest and weakest category, (2) most significant credibility or bias risk, (3) key missing verification element. No yield. No asset quality.'

    const prompt = `You are a senior property investment analyst producing an audit report for ${contextLabel}.
${contextWeightNote}
Risk level: ${riskLevel ?? 'Moderate'}

Overall alignment score: ${finalScore}/100 (${verdict})
Category scores (with applied weights): ${scoreSummary}
Weak areas: ${weakAreas.length > 0 ? weakAreas.join(', ') : 'None identified'}${propBlock}

CRITICAL ENGINE RULE: This is a ${contextType === 'property' ? 'PROPERTY DEAL QUALITY' : 'AGENT ADVICE CREDIBILITY'} audit.
${contextType === 'property'
  ? 'DO NOT include agent credibility signals, professionalism ratings, or agent track record observations. Focus entirely on deal quality: yield, asset condition, risk flags, location evidence, data quality.'
  : 'DO NOT calculate or estimate yield. DO NOT include physical asset quality observations. DO NOT mention property-specific risks (flood, power lines, asbestos). Focus entirely on advice credibility: data evidence, risk discussion depth, incentive disclosure, strategy alignment.'}

Respond ONLY with valid JSON:
{
  "executiveSummary": "${execSummaryInstruction}",
  "summary": "One direct sentence covering core verdict and primary gap.",
  "strengths": ["context-specific strengths only — see rules below"],
  "risks": ["context-specific risks only — see rules below"],
  "nextSteps": ["exactly 3 steps — see rules below"],
  "categoryNotes": {
    "Category Name": "One direct diagnostic sentence per category scoring below 7/10"
  }
}

Language rules:
- NEVER use: may, might, could, seems, appears, perhaps, potentially, suggest
- NEVER use: excellent, great, perfectly, outstanding, impressive
- ${contextType === 'property'
    ? 'executiveSummary example: "The computed rental yield of ~5.3% sits below the 6% benchmark for this asset class. Transmission line presence introduces a measurable resale discount risk not acknowledged in the recommendation. No independent price benchmarking was provided."'
    : 'executiveSummary example: "The recommendation demonstrates strategic alignment but Data & Evidence was not substantiated with verifiable sources. The Incentives category remains undisclosed, introducing bias risk. Risk scenarios (vacancy, rate movement, price correction) were not discussed."'}
- summary: one sentence, direct, specific
- ${strengthsRule}
- ${risksRule}
- ${nextStepsRule}
- categoryNotes: one direct diagnostic sentence per weak category (score < 7/10). Direct, not soft.

Tone: analytical, audit-style, direct, calm but critical.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 900,
    })

    const raw = completion.choices[0].message.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const insights = JSON.parse(jsonMatch[0])

    // Normalise
    if (!insights.summary) insights.summary = ''
    if (!insights.executiveSummary) insights.executiveSummary = ''
    if (!insights.categoryNotes) insights.categoryNotes = {}
    insights.strengths = (insights.strengths ?? []).slice(0, finalScore < 60 ? 2 : 3)
    insights.risks = (insights.risks ?? []).slice(0, 4)
    insights.nextSteps = (insights.nextSteps ?? []).slice(0, 3)

    // Property data from server extraction — never trust LLM for structured numbers
    const { price, rentRange, landSize, yearBuilt, flags } = propertyIntel.data
    const hasExtracted = price || rentRange || landSize || yearBuilt || (flags && flags.length > 0)
    insights.propertyData = hasExtracted ? propertyIntel.data : null

    return NextResponse.json(insights)
  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
