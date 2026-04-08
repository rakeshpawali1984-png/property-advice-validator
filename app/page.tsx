'use client'

import { useState, useCallback, useEffect } from 'react'
import Questionnaire from '@/components/Questionnaire'
import PropertyReviewMode from '@/components/PropertyReviewMode'
import Results from '@/components/Results'
import ConversationAnalyzer from '@/components/ConversationAnalyzer'
import PropertyLinkInput from '@/components/PropertyLinkInput'
import { CATEGORIES, PROPERTY_CATEGORIES } from '@/lib/questions'
import { calculateScore } from '@/lib/scoring'
import { Answers, OptionScore, ScorecardResult, ConversationSignals } from '@/lib/types'

type View = 'questionnaire' | 'results'
type ContextType = 'agent' | 'property'

// Property defaults to score 6 (partial/moderate) so all 13 are pre-filled from the start.
// Agent mode keeps null so users must answer explicitly.
function buildInitialAnswers(contextType: 'agent' | 'property' = 'agent'): Answers {
  const cats = contextType === 'property' ? PROPERTY_CATEGORIES : CATEGORIES
  const defaultScore: OptionScore | null = contextType === 'property' ? 6 : null
  const a: Answers = {}
  cats.forEach((cat) => cat.questions.forEach((q) => { a[q.id] = defaultScore }))
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
  const [hasPrefilled, setHasPrefilled] = useState(false)
  const [propertyInputMethod, setPropertyInputMethod] = useState<'conversation' | 'link' | null>(null)

  const activeCategories = contextType === 'property' ? PROPERTY_CATEGORIES : CATEGORIES

  function handleContextChange(ctx: ContextType) {
    setContextType(ctx)
    setAnswers(buildInitialAnswers(ctx))
    setPrefills({})
    setConversationText('')
    // Auto-show analyzer in property mode (it's the primary input); hide by default in agent mode
    setShowAnalyzer(ctx === 'property')
    setHasPrefilled(false)
    setPropertyInputMethod(null)
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
    setHasPrefilled(true)
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
    setHasPrefilled(false)
    setPropertyInputMethod(null)
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
            {/* Hero */}
            <div className="mb-1 space-y-1.5 text-center">
              <h2 className="text-2xl font-bold text-gray-900 leading-snug">
                Make better property decisions — before you commit
              </h2>
              <p className="text-sm text-gray-500">
                Evaluate a buyer agent before you engage them, or analyse a property before you buy.
              </p>
            </div>

            {/* Two use case cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: Buyer Agent */}
              <div
                onClick={() => handleContextChange('agent')}
                className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col ${
                  contextType === 'agent'
                    ? 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-100'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${contextType === 'agent' ? 'text-blue-500' : 'text-gray-400'}`}>
                  Before you sign or engage
                </p>
                <h3 className="text-base font-bold text-gray-900 mb-1">Evaluate a Buyer Agent</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">
                  Check if the advice is credible, data-backed, and transparent.
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleContextChange('agent') }}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    contextType === 'agent'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Evaluate Buyer Agent
                </button>
              </div>

              {/* Card 2: Property */}
              <div
                onClick={() => handleContextChange('property')}
                className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 flex flex-col ${
                  contextType === 'property'
                    ? 'bg-blue-50 border-blue-400 shadow-sm shadow-blue-100'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${contextType === 'property' ? 'text-blue-500' : 'text-gray-400'}`}>
                  Before you buy
                </p>
                <h3 className="text-base font-bold text-gray-900 mb-1">Analyse a Property</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">
                  Check risks, missing details, and whether the deal actually makes sense.
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleContextChange('property') }}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    contextType === 'property'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Analyse Property
                </button>
              </div>
            </div>

            {/* Input section — method selector for property mode, conversation toggle for agent mode */}
            <div>
              {contextType === 'property' ? (
                // Property mode: show method selector, then chosen input
                propertyInputMethod === null ? (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-gray-800 mb-1">How would you like to start?</p>
                    <p className="text-xs text-gray-400 mb-4">Choose an input method to pre-fill your analysis.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Conversation / notes card */}
                      <button
                        onClick={() => setPropertyInputMethod('conversation')}
                        className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 p-4 text-left transition-all duration-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 group-hover:border-blue-200 flex items-center justify-center shadow-sm">
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700">Paste conversation or notes</p>
                          <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">Paste a description, agent notes, or listing text</p>
                        </div>
                      </button>

                      {/* Link / address card */}
                      <button
                        onClick={() => setPropertyInputMethod('link')}
                        className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 p-4 text-left transition-all duration-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 group-hover:border-blue-200 flex items-center justify-center shadow-sm">
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 group-hover:text-blue-700">Enter property link or address</p>
                          <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">Type an address or paste a listing URL</p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!hasPrefilled && (
                      <button
                        onClick={() => setPropertyInputMethod(null)}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Change input method
                      </button>
                    )}
                    {propertyInputMethod === 'conversation' ? (
                      <ConversationAnalyzer onPrefill={handlePrefill} contextType={contextType} />
                    ) : (
                      <PropertyLinkInput onPrefill={handlePrefill} />
                    )}
                  </div>
                )
              ) : (
                // Agent mode: unchanged toggle
                !showAnalyzer ? (
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
                )
              )}
            </div>

            {/* Questionnaire — review mode for property (only after prefill), full dropdowns for agent */}
            {contextType === 'property' ? (
              hasPrefilled && <PropertyReviewMode categories={activeCategories} answers={answers} onChange={handleChange} prefills={prefills} />
            ) : (
              <Questionnaire categories={activeCategories} answers={answers} onChange={handleChange} prefills={prefills} />
            )}

            {/* Submit — only shown for property after prefill, always shown for agent */}
            {(contextType !== 'property' || hasPrefilled) && (
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
                    ? contextType === 'property' ? 'Analyse This Property' : 'Evaluate This Agent'
                    : `Answer ${Math.ceil(totalQuestions * 0.7) - answeredCount} more to continue`}
                </button>
                {canSubmit && (
                  <p className="text-center text-xs text-gray-400 mt-2.5">
                    No signup required · Your data stays private
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          result && (
            <div className="space-y-6">
              <div className="mb-2">
                <h2 className="text-2xl font-semibold text-gray-900 mb-1">
                  {result.contextType === 'property' ? 'Property Analysis' : 'Buyer Agent Assessment'}
                </h2>
                <p className="text-sm text-gray-500">
                  {result.contextType === 'property'
                    ? `Property recommendation — analysed across ${result.categoryScores.length} weighted categories.`
                    : `Buyer agent evaluation — analysed across ${result.categoryScores.length} weighted categories.`}
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
