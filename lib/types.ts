export type OptionScore = 10 | 6 | 2

export interface QuestionOption {
  label: string
  score: OptionScore
}

export interface Question {
  id: string
  text: string
  options: QuestionOption[]
}

export interface Category {
  id: string
  name: string
  weight: number // 0–1
  questions: Question[]
}

export interface Answers {
  [questionId: string]: OptionScore | null
}

export interface CategoryScore {
  id: string
  name: string
  score: number // 0–10
  weight: number
  answered: boolean
}

export interface ScorecardResult {
  finalScore: number
  verdict: 'Strong Alignment' | 'Moderate Alignment' | 'Low Confidence'
  categoryScores: CategoryScore[]
  weakAreas: string[]
  contextType: 'agent' | 'property'
  riskLevel: 'Low' | 'Moderate' | 'Elevated'
  capTriggered?: boolean       // true when a critical category weakness capped the score down
  answeredCoverage?: number    // 0–1: fraction of total weight that was answered
}

export interface PropertyData {
  address?: string
  price?: string
  rentRange?: string
  estimatedYield?: string
  landSize?: string
  yearBuilt?: string
  bedrooms?: string
  bathrooms?: string
  parking?: string
  flags?: string[]
}

export interface PropertyExtractResult extends ConversationSignals {
  propertyData?: PropertyData
}

export interface AIInsights {
  summary: string
  executiveSummary?: string
  strengths: string[]
  whatWorks?: string[]
  risks: string[]
  detectedSignals?: string[]  // retained for backward compat
  whyItMatters?: string       // retained for backward compat
  nextSteps: string[]
  propertyData?: PropertyData | null
  categoryNotes?: { [categoryName: string]: string }
}

export interface ConversationSignals {
  prefills: { [questionId: string]: OptionScore }
  summary: string
  rawText?: string
  propertyData?: PropertyData
  rejectedCount?: number   // number of LLM prefills that failed validation (invalid ID or score)
}

export interface SavedProperty {
  id: string
  label: string
  savedAt: number
  result: ScorecardResult
  propertyData: PropertyData | null
}
