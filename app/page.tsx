'use client'

import { useState, useCallback, useEffect } from 'react'
import Questionnaire from '@/components/Questionnaire'
import Results from '@/components/Results'
import ConversationAnalyzer from '@/components/ConversationAnalyzer'
import { CATEGORIES, PROPERTY_CATEGORIES } from '@/lib/questions'
import { calculateScore } from '@/lib/scoring'
import { Answers, OptionScore, ScorecardResult, ConversationSignals } from '@/lib/types'

type View = 'questionnaire' | 'results'
type ContextType = 'agent' | 'property'

function buildInitialAnswers(contextType: 'agent' | 'property' = 'agent'): Answers {
  const cats = contextType === 'property' ? PROPERTY_CATEGORIES : CATEGORIES
  const a: Answers = {}
  cats.forEach((cat) => cat.questions.forEach((q) => { a[q.id] = null }))
  return a
}

export default function Home() {
  const [view, setView] = useState<View>('questionnaire')
  const [contextType, setContextType] = useState<ContextType>('agent')
  const [answers, setAnswers] = useState<Answers>(() => buildInitialAnswers('agent'))
  const [prefills, setPrefills] = useState<{ [k: string]: OptionScore }>({})
  const [result, setResult] = useState<ScorecardResult | null>(null)
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const [conversationText, setConversationText] = useState('')

  const activeCategories = contextType === 'property' ? PROPERTY_CATEGORIES : CATEGORIES

  function handleContextChange(ctx: ContextType) {
    setContextType(ctx)
    setAnswers(buildInitialAnswers(ctx))
    setPrefills({})
    setConversationText('')
    setShowAnalyzer(false)
  }

  const handleChange = useCallback((questionId: string, score: OptionScore) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }))
  }, [])

  const handlePrefill = useCallback((signals: ConversationSignals) => {
    setPrefills(signals.prefills)
    if (signals.rawText) setConversationText(signals.rawText)
    setAnswers((prev) => {
      const next = { ...prev }
      for (const [id, score] of Object.entries(signals.prefills)) {
        next[id] = score
      }
      return next
    })
  }, [])

  const totalQuestions = activeCategories.flatMap((c) => c.questions).length
  const answeredCount = Object.values(answers).filter((v) => v !== null).length
  const allAnswered = answeredCount === totalQuestions
  const canSubmit = answeredCount >= Math.ceil(totalQuestions * 0.7)

  function handleSubmit() {
    const scored = calculateScore(answers, contextType)
    setResult(scored)
    setView('results')
  }

  useEffect(() => {
    if (view === 'results') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [view])

  function handleReset() {
    setAnswers(buildInitialAnswers(contextType))
    setPrefills({})
    setResult(null)
    setView('questionnaire')
    setShowAnalyzer(false)
    setConversationText('')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 tracking-tight">Property Advice Analysis</h1>
              <p className="text-xs text-gray-400">Structured advice audit framework</p>
            </div>
          </div>
          {view === 'questionnaire' && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full tabular-nums">
              {answeredCount}/{totalQuestions} completed
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {view === 'questionnaire' ? (
          <div className="space-y-6">
            {/* Hero / value proposition */}
            <div className="mb-4 space-y-2">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                Validate property advice before you commit
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                Check what your agent said or a property you're considering — and instantly spot risks, missing data, and potential bias.
              </p>
              <p className="text-sm text-gray-500 border-l-2 border-blue-200 pl-3 italic">
                Get a structured second opinion before making a high-value decision.
              </p>
            </div>

            {/* Context Selector */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">What would you like to check?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleContextChange('agent')}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-3 px-4 rounded-xl border transition-all duration-200 ${
                    contextType === 'agent'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">Check agent advice</span>
                  <span className={`text-xs ${contextType === 'agent' ? 'text-blue-100' : 'text-gray-400'}`}>Chat, email, or notes from a buyer agent</span>
                </button>
                <button
                  onClick={() => handleContextChange('property')}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-3 px-4 rounded-xl border transition-all duration-200 ${
                    contextType === 'property'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">Check this property</span>
                  <span className={`text-xs ${contextType === 'property' ? 'text-blue-100' : 'text-gray-400'}`}>Price, rent, features, or listing details</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2.5">
                {contextType === 'agent'
                  ? 'Looks for bias, gaps in advice, and whether the agent is acting in your interest.'
                  : 'Checks yield, risk flags, and whether the key numbers in the deal add up.'}
              </p>
            </div>

            {/* Conversation import toggle */}
            <div>
              {!showAnalyzer ? (
                <button
                  onClick={() => setShowAnalyzer(true)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl border border-blue-200 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Import from conversation to pre-fill answers
                </button>
              ) : (
                <ConversationAnalyzer onPrefill={handlePrefill} contextType={contextType} />
              )}
            </div>

            {/* Questionnaire */}
            <Questionnaire categories={activeCategories} answers={answers} onChange={handleChange} prefills={prefills} />

            {/* Submit */}
            <div className="pt-2 pb-10">
              {!allAnswered && canSubmit && (
                <p className="text-xs text-gray-400 text-center mb-3">
                  {totalQuestions - answeredCount} question{totalQuestions - answeredCount !== 1 ? 's' : ''} remaining — you can generate your score now
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all duration-200 shadow-md shadow-blue-600/25"
              >
                {canSubmit
                  ? 'Analyse My Advice'
                  : `Answer ${Math.ceil(totalQuestions * 0.7) - answeredCount} more to continue`}
              </button>
              {canSubmit && (
                <p className="text-center text-xs text-gray-400 mt-2.5">
                  No signup required · Your data stays private
                </p>
              )}
            </div>
          </div>
        ) : (
          result && (
            <div className="space-y-6">
              <div className="mb-2">
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">Property Advice Assessment</h2>
                <p className="text-sm text-gray-500">
                  {result.contextType === 'property'
                    ? `Property recommendation — analysed across ${result.categoryScores.length} weighted categories.`
                    : `Initial agent discussion — analysed across ${result.categoryScores.length} weighted categories.`}
                </p>
              </div>
              <Results result={result} conversationText={conversationText} onReset={handleReset} />
            </div>
          )
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-center border-t border-gray-100 mt-4">
        <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150 underline underline-offset-2">
          Privacy Policy
        </a>
      </footer>
    </div>
  )
}
