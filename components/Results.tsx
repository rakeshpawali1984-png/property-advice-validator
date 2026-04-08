'use client'

import { useState, useEffect, useCallback } from 'react'
import { ScorecardResult, AIInsights, CategoryScore, PropertyData } from '@/lib/types'
import { VERDICT_CONFIG } from '@/lib/scoring'

interface Props {
  result: ScorecardResult
  conversationText?: string
  onReset: () => void
  onResetToContext?: (ctx: 'property' | 'agent') => void
  onSaveToCompare?: (propertyData: PropertyData | null) => void
  isSaved?: boolean
  isFull?: boolean
}

export default function Results({ result, conversationText, onReset, onResetToContext, onSaveToCompare, isSaved, isFull }: Props) {
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [insightError, setInsightError] = useState('')
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())
  const [showDetail, setShowDetail] = useState(false)
  const [reportTime] = useState(() =>
    new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  )

  const config = VERDICT_CONFIG[result.verdict]

  // Confidence label derived from score and answer coverage
  const answeredCount = result.categoryScores.filter((c) => c.answered).length
  const totalCats = result.categoryScores.length
  const coverage = answeredCount / totalCats
  const confidence =
    coverage >= 0.9 && result.finalScore >= 80
      ? 'High'
      : coverage >= 0.7 && result.finalScore >= 60
      ? 'Medium'
      : 'Low'
  const confidenceColor =
    confidence === 'High' ? 'text-green-600' : confidence === 'Medium' ? 'text-amber-600' : 'text-red-500'

  function buildConfidenceReason(): string {
    const reasons: string[] = []
    const unanswered = result.categoryScores.filter((c) => !c.answered).length
    if (unanswered > 0) reasons.push(`${unanswered} categor${unanswered > 1 ? 'ies' : 'y'} not assessed`)
    if (result.weakAreas.length > 2) reasons.push('multiple categories below threshold')
    if (result.finalScore < 60) reasons.push('overall alignment below benchmark')
    if (insights?.detectedSignals && insights.detectedSignals.length > 0) reasons.push('language signals detected')
    if (reasons.length === 0) reasons.push(`${answeredCount} of ${totalCats} categories fully assessed`)
    return reasons.join(', ')
  }

  const toggleCheck = (i: number) => setCheckedItems((prev) => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const generateInsights = useCallback(async () => {
    setLoadingInsights(true)
    setInsightError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryScores: result.categoryScores,
          weakAreas: result.weakAreas,
          verdict: result.verdict,
          finalScore: result.finalScore,
          contextType: result.contextType,
          riskLevel: result.riskLevel,
          conversationText: conversationText ?? '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setInsights(data)
    } catch {
      setInsightError('Could not generate the analysis. Please try again.')
    } finally {
      setLoadingInsights(false)
    }
  }, [result])

  // Auto-generate on mount
  useEffect(() => {
    generateInsights()
  }, [generateInsights])

  return (
    <div className="space-y-5">

      {/* Report Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 gap-3 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">Advice Analysis Report</span>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{reportTime}</span>
      </div>

      {/* Score hero */}
      <div className={`rounded-2xl border-2 ${config.border} ${config.gradient} p-5 sm:p-8 text-center shadow-md`}>
        <div className="mb-2">
          <span className={`text-5xl sm:text-8xl font-extrabold ${config.scoreColor} tabular-nums tracking-tight`}>
            {result.finalScore}
          </span>
          <span className="text-gray-400 text-lg sm:text-2xl font-light ml-1">/100</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-white/80 ${config.color} border ${config.border}`}>
            {result.verdict}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            result.riskLevel === 'Elevated'
              ? 'bg-red-50 text-red-700 border-red-200'
              : result.riskLevel === 'Moderate'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <span className="text-[10px] leading-none">{result.riskLevel === 'Elevated' ? '🔴' : result.riskLevel === 'Moderate' ? '🟡' : '🟢'}</span>
            {result.riskLevel} Risk
          </div>
        </div>
        <p className={`text-xs font-medium ${confidenceColor} mb-4`}>
          {confidence === 'High' ? 'High confidence' : confidence === 'Medium' ? 'Moderate confidence' : 'Limited data available'} &mdash; {buildConfidenceReason()}
        </p>
        {result.capTriggered && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 max-w-xs mx-auto">
            Score reduced — a critical category scored below threshold
          </p>
        )}
        {insights?.summary ? (
          <div className="max-w-md mx-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Quick take</p>
            <p className="text-gray-700 text-sm leading-relaxed font-medium">{insights.summary}</p>
          </div>
        ) : loadingInsights ? (
          <p className="text-gray-400 text-sm">Preparing analysis…</p>
        ) : (
          <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">{config.description}</p>
        )}
      </div>

      {/* Key Metrics — property mode only, with What Works embedded */}
      {result.contextType === 'property' && insights?.propertyData && (
        <KeyMetricsCard data={insights.propertyData} whatWorks={insights.whatWorks} />
      )}

      {/* Agent Scorecard — category performance + What Works */}
      {result.contextType === 'agent' && (
        <AgentMetricsCard categoryScores={result.categoryScores} whatWorks={insights?.whatWorks} />
      )}

      {/* Collapsible Detailed Report toggle */}
      <button
        onClick={() => setShowDetail((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors duration-200">
            <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            {loadingInsights ? 'Preparing detailed report…' : 'Detailed Report'}
          </span>
          {loadingInsights && (
            <svg className="animate-spin w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {!loadingInsights && insights && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {[
                insights.risks?.length ? `${insights.risks.length} risk${insights.risks.length > 1 ? 's' : ''}` : null,
                insights.nextSteps?.length ? `${insights.nextSteps.length} to verify` : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showDetail ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible content */}
      {showDetail && (
        <div className="space-y-4">
          {/* Error */}
          {insightError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
              <p className="text-sm text-red-500">{insightError}</p>
              <button
                onClick={generateInsights}
                className="text-xs font-semibold text-red-600 hover:text-red-700 underline ml-4 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading placeholder */}
          {loadingInsights && !insights && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex items-center justify-center gap-3 text-gray-400">
              <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">Preparing your assessment…</span>
            </div>
          )}

          {insights && (
            <>
              {/* Executive Summary */}
              {insights.executiveSummary && (
                <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">What this means</p>
                  </div>
                  <p className="text-sm text-gray-700 leading-7">{insights.executiveSummary}</p>
                </div>
              )}

              {/* Key Risks */}
              <AnalysisCard
                title="What could go wrong"
                icon="⚠"
                items={insights.risks}
                dotColor="bg-red-400"
                textColor="text-red-600"
                bg="bg-red-50"
                border="border-red-100"
              />

              {/* What Works — agent mode only; property mode shows it in Key Metrics */}
              {result.contextType !== 'property' && insights.whatWorks && insights.whatWorks.length > 0 && (
                <div className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-md bg-green-100 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-green-700">What works</p>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">for balance</span>
                  </div>
                  <ul className="space-y-2.5">
                    {insights.whatWorks.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-green-400" />
                        <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What to Verify */}
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-md bg-blue-200 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700">What to check next</p>
                </div>
                <p className="text-xs text-blue-500 mb-4">Before you move forward, check these:</p>
                <ul className="space-y-3">
                  {insights.nextSteps.map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 cursor-pointer group select-none"
                      onClick={() => toggleCheck(i)}
                    >
                      <div className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
                        checkedItems.has(i) ? 'bg-blue-600 border-blue-600' : 'border-blue-300 group-hover:border-blue-500 bg-white'
                      }`}>
                        {checkedItems.has(i) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed transition-colors duration-150 ${
                        checkedItems.has(i) ? 'text-gray-400 line-through' : 'text-gray-700'
                      }`}>{step}</span>
                    </li>
                  ))}
                </ul>
                {checkedItems.size === insights.nextSteps.length && insights.nextSteps.length > 0 && (
                  <p className="text-xs text-blue-600 font-semibold mt-4 text-center">All items reviewed ✓</p>
                )}
              </div>

              {/* Category Breakdown */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800">Detailed breakdown</h3>
                </div>
                <div className="p-6 space-y-5">
                  {result.categoryScores.map((cat) => {
                    const pct = cat.answered ? (cat.score / 10) * 100 : 0
                    const barColor = cat.score >= 7 ? 'bg-green-500' : cat.score >= 5 ? 'bg-amber-400' : 'bg-red-400'
                    const scoreTextColor = cat.score >= 7 ? 'text-green-700' : cat.score >= 5 ? 'text-amber-700' : 'text-red-400'
                    const categoryNote = insights?.categoryNotes?.[cat.name]
                    const isWeak = cat.answered && cat.score < 7
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{(cat.weight * 100).toFixed(0)}%</span>
                            <span className={`text-sm font-bold tabular-nums ${cat.answered ? scoreTextColor : 'text-gray-300'}`}>
                              {cat.answered ? `${cat.score.toFixed(1)}/10` : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${cat.answered ? barColor : 'bg-gray-200'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {(categoryNote || isWeak) && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                            {categoryNote ?? 'Insufficient evidence in this area — request documented responses before proceeding.'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Regenerate */}
              <div className="flex justify-end">
                <button
                  onClick={generateInsights}
                  disabled={loadingInsights}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 py-1"
                >
                  {loadingInsights ? (
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="pt-2 pb-2 space-y-2.5">
        {/* Save to Compare — property mode only */}
        {result.contextType === 'property' && onSaveToCompare && (
          isSaved ? (
            <div className="w-full py-3 rounded-xl bg-green-50 border border-green-200 text-sm font-semibold text-green-700 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved to comparison tray
            </div>
          ) : (
            <button
              onClick={() => onSaveToCompare(insights?.propertyData ?? null)}
              disabled={isFull}
              className="w-full py-3 rounded-xl bg-white hover:bg-blue-50 active:bg-blue-100 border border-blue-200 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-blue-700 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isFull ? 'Comparison tray full (3/3)' : 'Save to Comparison Tray'}
            </button>
          )
        )}
        <button
          onClick={() => onResetToContext ? onResetToContext('property') : onReset()}
          className="w-full py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 active:bg-gray-950 text-sm font-semibold text-white transition-all duration-200 shadow-md flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Check another property
        </button>
        <button
          onClick={() => onResetToContext ? onResetToContext('agent') : onReset()}
          className="w-full py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-sm font-semibold text-gray-600 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Check agent advice
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-gray-400 leading-relaxed pb-6 px-4">
        This analysis is based on the information provided and is intended as a decision-support tool only. It does not constitute financial or legal advice.
      </p>

    </div>
  )
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function KeyMetricsCard({ data, whatWorks }: { data: NonNullable<AIInsights['propertyData']>; whatWorks?: string[] }) {
  const metrics: { label: string; value: string | undefined; highlight?: boolean }[] = [
    { label: 'Gross rental yield', value: data.estimatedYield, highlight: true },
    { label: 'Purchase price', value: data.price },
    { label: 'Rental estimate', value: data.rentRange },
    { label: 'Land size', value: data.landSize },
    { label: 'Year built', value: data.yearBuilt },
  ].filter((f): f is { label: string; value: string; highlight?: boolean } => !!f.value)

  const hasFlags = data.flags && data.flags.length > 0
  if (metrics.length === 0 && !hasFlags) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Quick numbers</p>
      </div>
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {metrics.map(({ label, value, highlight }) => (
            <div
              key={label}
              className={`rounded-xl p-3 ${
                highlight ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50'
              }`}
            >
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className={`text-sm font-semibold ${
                highlight ? 'text-indigo-700' : 'text-gray-800'
              }`}>{value}</p>
            </div>
          ))}
        </div>
      )}
      {hasFlags && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">Risk flags</p>
          <ul className="space-y-1.5">
            {data.flags!.map((flag, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed">{flag}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {whatWorks && whatWorks.length > 0 && (
        <div className={`${hasFlags || metrics.length > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-2.5 h-2.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">What works</p>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">for balance</span>
          </div>
          <ul className="space-y-1.5">
            {whatWorks.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AgentMetricsCard({ categoryScores, whatWorks }: { categoryScores: CategoryScore[]; whatWorks?: string[] }) {
  const answered = categoryScores.filter((c) => c.answered)
  const top = answered.length > 0 ? answered.reduce((a, b) => (a.score > b.score ? a : b)) : null
  const weak = answered.length > 0 ? answered.reduce((a, b) => (a.score < b.score ? a : b)) : null

  function tileStyle(cat: CategoryScore): { bg: string; textScore: string; dot: string } {
    if (!cat.answered) return { bg: 'bg-gray-50', textScore: 'text-gray-400', dot: 'bg-gray-300' }
    if (cat.score >= 7) return { bg: 'bg-green-50 border border-green-100', textScore: 'text-green-700', dot: 'bg-green-400' }
    if (cat.score >= 5) return { bg: 'bg-amber-50 border border-amber-100', textScore: 'text-amber-700', dot: 'bg-amber-400' }
    return { bg: 'bg-red-50 border border-red-100', textScore: 'text-red-600', dot: 'bg-red-400' }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Agent Scorecard</p>
        <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {answered.length}/{categoryScores.length} assessed
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {categoryScores.map((cat) => {
          const style = tileStyle(cat)
          return (
            <div key={cat.id} className={`rounded-xl p-3 ${style.bg}`}>
              <p className="text-xs text-gray-400 mb-0.5 truncate">{cat.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
                <p className={`text-sm font-semibold ${style.textScore}`}>
                  {cat.answered ? `${Math.round(cat.score * 10)}/100` : '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {(top || weak) && (
        <div className="flex gap-2 flex-wrap mb-1">
          {top && top !== weak && (
            <span className="text-[11px] flex items-center gap-1 bg-green-50 border border-green-100 px-2 py-1 rounded-lg text-green-700 font-medium">
              ✓ Strongest: {top.name}
            </span>
          )}
          {weak && weak !== top && weak.score < 6 && (
            <span className="text-[11px] flex items-center gap-1 bg-red-50 border border-red-100 px-2 py-1 rounded-lg text-red-600 font-medium">
              ⚠ Weakest: {weak.name}
            </span>
          )}
        </div>
      )}

      {whatWorks && whatWorks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center shrink-0">
              <svg className="w-2.5 h-2.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">What works</p>
            <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">for balance</span>
          </div>
          <ul className="space-y-1.5">
            {whatWorks.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <span className="text-xs text-gray-600 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AnalysisCard({
  title,
  icon,
  items,
  dotColor,
  textColor,
  bg,
  border,
}: {
  title: string
  icon?: string
  items: string[]
  dotColor: string
  textColor: string
  bg: string
  border: string
}) {
  if (!items || items.length === 0) return null
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-sm leading-none font-normal">{icon}</span>}
        <p className={`text-xs font-bold uppercase tracking-widest ${textColor}`}>{title}</p>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotColor}`} />
            <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
