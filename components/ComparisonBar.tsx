'use client'

import { SavedProperty } from '@/lib/types'

interface Props {
  saved: SavedProperty[]
  onRemove: (id: string) => void
  onCompare: () => void
}

export default function ComparisonBar({ saved, onRemove, onCompare }: Props) {
  if (saved.length === 0) return null

  const canCompare = saved.length >= 2

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Slots */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">Compare</span>
          {saved.map((p) => {
            const scoreColor =
              p.result.finalScore >= 70
                ? 'bg-green-100 text-green-800 border-green-200'
                : p.result.finalScore >= 50
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-red-100 text-red-800 border-red-200'
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5 border text-xs font-semibold ${scoreColor}`}
              >
                <span className="max-w-[100px] truncate">{p.label}</span>
                <span className="tabular-nums">{p.result.finalScore}</span>
                <button
                  onClick={() => onRemove(p.id)}
                  className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
          {/* Empty slots */}
          {Array.from({ length: 3 - saved.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 border border-dashed border-gray-200 text-xs text-gray-300"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Empty
            </div>
          ))}
        </div>

        {/* Compare CTA */}
        <button
          onClick={onCompare}
          disabled={!canCompare}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-35 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all duration-200 shadow-sm shadow-blue-600/20"
        >
          Compare
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
