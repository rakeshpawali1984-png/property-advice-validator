import { Answers, CategoryScore, OptionScore, ScorecardResult } from './types'
import { CATEGORIES, PROPERTY_CATEGORIES } from './questions'

// Agent context — weight overrides applied to the 7-category agent set
// Maps to spec: Strategy Fit (25%), Data & Evidence (20%), Risk Discussion (15%=asset_quality),
// Professionalism (15%), Incentives (15%), Track Record (10%). Financials kept at 5%.
const AGENT_WEIGHTS: Record<string, number> = {
  strategy_fit: 0.25,
  data_evidence: 0.20,
  asset_quality: 0.15,  // "Risk Discussion" proxy — did agent discuss risk/growth substance?
  financials: 0.05,
  track_record: 0.05,   // reduced to allow incentives increase
  professionalism: 0.15,
  incentives: 0.15,     // increased per spec — undisclosed bias is a critical signal
}

// Property context — weights applied to the 5-category property set
// (categories carry their own weight values; this map is the canonical source)
const PROPERTY_WEIGHTS: Record<string, number> = {
  prop_asset: 0.25,
  prop_finance: 0.25,
  prop_location: 0.15,
  prop_risk: 0.20,
  prop_evidence: 0.15,
}

export function calculateScore(answers: Answers, contextType: 'agent' | 'property' = 'agent'): ScorecardResult {
  const isProperty = contextType === 'property'
  const activeCategories = isProperty ? PROPERTY_CATEGORIES : CATEGORIES
  const weightMap = isProperty ? PROPERTY_WEIGHTS : AGENT_WEIGHTS

  const categoryScores: CategoryScore[] = activeCategories.map((cat) => {
    const scores = cat.questions
      .map((q) => answers[q.id])
      .filter((s): s is OptionScore => s !== null && s !== undefined)

    const answered = scores.length > 0
    const rawScore = answered ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const weight = weightMap[cat.id] ?? cat.weight

    return {
      id: cat.id,
      name: cat.name,
      score: rawScore,
      weight,
      answered,
    }
  })

  const answeredWeightSum = categoryScores.reduce((total, cat) => total + (cat.answered ? cat.weight : 0), 0)
  const rawWeightedSum = categoryScores.reduce((total, cat) => total + (cat.answered ? cat.score * cat.weight : 0), 0)
  // Renormalize against answered weights — max is always 100 regardless of which categories are skipped
  const finalScore = answeredWeightSum > 0 ? (rawWeightedSum / answeredWeightSum) * 10 : 0

  const weakAreas = categoryScores
    .filter((c) => c.answered && c.score < 6)
    .map((c) => c.name)

  // Elevated riskLevel signal — context-agnostic (uses whatever categories are active)
  const worstTwo = categoryScores
    .filter((c) => c.answered)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
  const bothCritical = worstTwo.length === 2 && worstTwo.every((c) => c.score < 6)

  // ─── Context-specific score capping ──────────────────────────────────────────
  // Rules are engine-specific — no cross-contamination.
  let cappedScore = finalScore
  let capTriggered = false

  if (isProperty) {
    // Property engine: Risk Factors OR Evidence weak → cap at 65
    const propRiskCat = categoryScores.find((c) => c.id === 'prop_risk')
    const propEvidCat = categoryScores.find((c) => c.id === 'prop_evidence')
    const propRiskWeak = !!(propRiskCat?.answered && propRiskCat.score < 6)
    const propEvidWeak = !!(propEvidCat?.answered && propEvidCat.score < 6)
    if (propRiskWeak || propEvidWeak) { cappedScore = Math.min(cappedScore, 65); capTriggered = true }
  } else {
    // Agent engine: separate cap per critical category (caps compound via min)
    const dataCat = categoryScores.find((c) => c.id === 'data_evidence')
    const riskDisCat = categoryScores.find((c) => c.id === 'asset_quality')  // Risk Discussion proxy
    const incCat = categoryScores.find((c) => c.id === 'incentives')
    if (dataCat?.answered && dataCat.score < 6) { cappedScore = Math.min(cappedScore, 65); capTriggered = true }
    if (riskDisCat?.answered && riskDisCat.score < 6) { cappedScore = Math.min(cappedScore, 60); capTriggered = true }
    if (incCat?.answered && incCat.score < 6) { cappedScore = Math.min(cappedScore, 60); capTriggered = true }
  }

  // Tighter verdict thresholds aligned with capping
  let verdict: ScorecardResult['verdict']
  if (cappedScore >= 75) verdict = 'Strong Alignment'
  else if (cappedScore >= 60) verdict = 'Moderate Alignment'
  else verdict = 'Low Confidence'

  // A triggered cap means a critical category is weak — always at least Moderate risk
  const riskLevel: ScorecardResult['riskLevel'] =
    bothCritical ? 'Elevated' :
    (weakAreas.length >= 2 || capTriggered) ? 'Moderate' : 'Low'

  return { finalScore: Math.round(cappedScore), verdict, categoryScores, weakAreas, contextType, riskLevel }
}

export const VERDICT_CONFIG = {
  'Strong Alignment': {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    gradient: 'bg-gradient-to-br from-green-50 to-white',
    ring: 'ring-green-100',
    bar: 'bg-green-500',
    scoreColor: 'text-green-600',
    description: 'The advice and recommendations show strong alignment with your stated goals and financial position.',
  },
  'Moderate Alignment': {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    gradient: 'bg-gradient-to-br from-amber-50 to-white',
    ring: 'ring-amber-100',
    bar: 'bg-amber-500',
    scoreColor: 'text-amber-600',
    description: 'The interaction shows reasonable alignment with your goals, though some areas warrant further clarification.',
  },
  'Low Confidence': {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    gradient: 'bg-gradient-to-br from-red-50 to-white',
    ring: 'ring-red-100',
    bar: 'bg-red-500',
    scoreColor: 'text-red-600',
    description: 'Several gaps were identified in the advice quality or transparency. Consider seeking further clarification or a second opinion.',
  },
} as const
