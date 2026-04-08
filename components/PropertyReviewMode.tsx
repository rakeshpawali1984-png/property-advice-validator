'use client'

import { useState, useRef, useEffect } from 'react'
import { Category, Answers, OptionScore } from '@/lib/types'

interface Props {
  categories: Category[]
  answers: Answers
  onChange: (questionId: string, score: OptionScore) => void
  prefills?: Record<string, OptionScore>
}

function scoreChipStyle(score: OptionScore | null | undefined) {
  if (score === 10) return 'text-green-700 bg-green-50 border-green-200'
  if (score === 6) return 'text-amber-700 bg-amber-50 border-amber-200'
  if (score === 2) return 'text-red-700 bg-red-50 border-red-200'
  return 'text-gray-400 bg-gray-50 border-gray-200'
}

function categoryStatusBadge(questions: Category['questions'], answers: Answers) {
  const scores = questions.map((q) => answers[q.id]).filter((s): s is OptionScore => s !== null)
  if (scores.length === 0) return { label: 'Not assessed', cls: 'text-gray-500 bg-gray-100' }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg >= 8) return { label: 'Strong', cls: 'text-green-700 bg-green-100' }
  if (avg >= 5) return { label: 'Moderate', cls: 'text-amber-700 bg-amber-100' }
  return { label: 'Needs attention', cls: 'text-red-700 bg-red-100' }
}

// Self-contained dropdown (mirrors Questionnaire's QuestionDropdown)
function OptionDropdown({
  options,
  value,
  onChange,
}: {
  options: Array<{ score: number; label: string }>
  value: OptionScore | null | undefined
  onChange: (score: OptionScore) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.score === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-sm rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 bg-white border border-gray-200 hover:border-gray-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
      >
        <span className={value !== null && value !== undefined ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? selected.label : 'Select…'}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden transition-all duration-200 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'}`}>
        {options.map((opt) => (
          <button
            key={opt.score}
            type="button"
            onClick={() => { onChange(opt.score as OptionScore); setOpen(false) }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${opt.score === value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PropertyReviewMode({ categories, answers, onChange, prefills = {} }: Props) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  const totalQuestions = categories.flatMap((c) => c.questions).length
  const filledCount = Object.values(answers).filter((v) => v !== null).length
  const prefillCount = Object.keys(prefills).length

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">
            {prefillCount > 0
              ? "We've pre-filled your analysis based on available data."
              : 'Review pre-filled defaults and adjust to match your property.'}
          </p>
          <p className="text-xs text-blue-500 mt-0.5">Review each section and edit if needed before generating your score.</p>
        </div>
        <span className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full shrink-0 tabular-nums whitespace-nowrap">
          {filledCount}/{totalQuestions} filled
        </span>
      </div>

      {/* Category review cards */}
      {categories.map((cat) => {
        const status = categoryStatusBadge(cat.questions, answers)
        const isExpanded = expandedCats.has(cat.id)

        return (
          <div key={cat.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{cat.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}>
                  {status.label}
                </span>
              </div>
              <button
                onClick={() => toggleExpand(cat.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150 shrink-0 ${
                  isExpanded
                    ? 'bg-gray-100 text-gray-600 border-gray-200'
                    : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                }`}
              >
                {isExpanded ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                    Done
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </>
                )}
              </button>
            </div>

            {/* Summary pills (collapsed) */}
            {!isExpanded && (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {cat.questions.map((q) => {
                  const score = answers[q.id]
                  const isPrefilled = prefills[q.id] !== undefined && answers[q.id] === prefills[q.id]
                  const selectedOption = q.options.find((o) => o.score === score)
                  // First clause (before comma or dash) as short label
                  const shortLabel = selectedOption
                    ? selectedOption.label.split(/[,–—]/)[0].trim().slice(0, 25)
                    : 'Not set'

                  return (
                    <span
                      key={q.id}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${scoreChipStyle(score as OptionScore)}`}
                    >
                      {shortLabel}
                      {isPrefilled && (
                        <svg className="w-3 h-3 opacity-60 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Expanded edit view */}
            {isExpanded && (
              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {cat.questions.map((q) => {
                  const isPrefilled = prefills[q.id] !== undefined && answers[q.id] === prefills[q.id]
                  return (
                    <div key={q.id} className="px-5 py-4 space-y-2.5">
                      <p className="text-sm text-gray-700 leading-relaxed">{q.text}</p>
                      {isPrefilled && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Pre-filled from input
                        </span>
                      )}
                      <OptionDropdown
                        options={q.options}
                        value={answers[q.id]}
                        onChange={(score) => onChange(q.id, score)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
