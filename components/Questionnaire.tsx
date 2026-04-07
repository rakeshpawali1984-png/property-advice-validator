'use client'

import { useState, useRef, useEffect } from 'react'
import { Category, Answers, OptionScore } from '@/lib/types'

interface Props {
  categories: Category[]
  answers: Answers
  onChange: (questionId: string, score: OptionScore) => void
  prefills?: { [questionId: string]: OptionScore }
}

function QuestionDropdown({
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
  const isAnswered = value !== null && value !== undefined

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-2
          bg-white border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
          hover:border-gray-400
          ${isAnswered ? 'border-gray-300' : 'border-gray-200'}
        `}
      >
        <span className={isAnswered ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? selected.label : 'Select your answer\u2026'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden transition-all duration-200
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'}
        `}
      >
        {options.map((opt) => {
          const isSelected = opt.score === value
          return (
            <button
              key={opt.score}
              type="button"
              onClick={() => {
                onChange(opt.score as OptionScore)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100
                ${isSelected ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}
              `}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Questionnaire({ categories, answers, onChange, prefills = {} }: Props) {
  const totalQuestions = categories.flatMap((c) => c.questions).length
  const answered = Object.values(answers).filter((v) => v !== null).length
  const progress = Math.round((answered / totalQuestions) * 100)

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{answered}/{totalQuestions}</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2.5">
          {progress === 100 ? (
            <p className="text-xs text-green-600 font-semibold">All questions answered ✓</p>
          ) : (
            <p className="text-xs text-gray-400">{progress}% complete &bull; {answered}/{totalQuestions} answered</p>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.map((cat, catIndex) => (
        <div
          key={cat.id}
          className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <span className="bg-blue-50 text-blue-600 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
                {catIndex + 1}
              </span>
              <h3 className="text-base font-medium text-gray-800">{cat.name}</h3>
            </div>
            <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-medium">
              {(cat.weight * 100).toFixed(0)}% weight
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {cat.questions.map((q, qIndex) => {
              const isPrefilled = prefills[q.id] !== undefined && answers[q.id] === prefills[q.id]
              const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined

              return (
                <div
                  key={q.id}
                  className={`px-6 py-5 transition-all duration-200 ${
                    isAnswered ? 'bg-green-50/40' : 'hover:bg-gray-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-xs font-medium text-gray-400 mt-0.5 w-5 shrink-0 text-right tabular-nums">
                      {qIndex + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-700 leading-relaxed">{q.text}</p>
                        {isAnswered && (
                          <svg
                            className="w-4 h-4 text-green-500 shrink-0 mt-0.5"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                          </svg>
                        )}
                      </div>
                      {isPrefilled && (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Imported from conversation
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-8">
                    <QuestionDropdown
                      options={q.options}
                      value={answers[q.id]}
                      onChange={(score) => onChange(q.id, score)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
