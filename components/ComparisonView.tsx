'use client'

import { useState, useRef, useEffect } from 'react'
import { SavedProperty } from '@/lib/types'

interface Props {
  saved: SavedProperty[]
  onRemove: (id: string) => void
  onRename: (id: string, newLabel: string) => void
  onBack: () => void
  onClear: () => void
  onAddAnother: () => void
}

// Returns index of the strictly best (highest) numeric value, or -1 if tied/all null
function bestIdx(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return -1
  const max = Math.max(...valid)
  const hits = values.filter((v) => v === max)
  return hits.length === 1 ? values.indexOf(max) : -1
}

function worstIdx(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return -1
  const min = Math.min(...valid)
  const hits = values.filter((v) => v === min)
  return hits.length === 1 ? values.indexOf(min) : -1
}

function parseNumber(s?: string): number | null {
  if (!s) return null
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

function riskRank(r: string): number {
  return { Low: 0, Moderate: 1, Elevated: 2 }[r as 'Low' | 'Moderate' | 'Elevated'] ?? 1
}

function buildSummary(saved: SavedProperty[]): string {
  if (saved.length < 2) return ''
  const sorted = [...saved].sort((a, b) => b.result.finalScore - a.result.finalScore)
  const best = sorted[0]
  const runner = sorted[sorted.length - 1]
  const gap = best.result.finalScore - runner.result.finalScore
  const yields = saved.map((s) => parseNumber(s.propertyData?.estimatedYield))
  const yieldBestI = bestIdx(yields)
  const parts: string[] = []
  parts.push(`${best.label} scores ${gap} pt${gap !== 1 ? 's' : ''} higher`)
  if (riskRank(best.result.riskLevel) < riskRank(runner.result.riskLevel)) {
    parts[0] += ' with lower risk'
  }
  if (yieldBestI !== -1 && saved[yieldBestI].id !== best.id) {
    parts.push(`${saved[yieldBestI].label} offers a better rental yield`)
  }
  return parts.join('. ') + '.'
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-green-700 bg-green-50 border-green-200' :
    score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200'
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      <span className="text-[10px]">
        {score >= 70 ? '🟢' : score >= 50 ? '🟡' : '🔴'}
      </span>
      {score}
    </div>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  const color =
    risk === 'Low' ? 'text-green-700 bg-green-50 border-green-200' :
    risk === 'Moderate' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${color}`}>
      {risk}
    </span>
  )
}

function MiniBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const bar = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-400'
  const text = score >= 7 ? 'text-green-700' : score >= 5 ? 'text-amber-700' : 'text-red-600'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`text-sm font-bold ${text} tabular-nums`}>{score.toFixed(1)}</span>
      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EditableLabel({ id, label, onRename }: { id: string; label: string; onRename: (id: string, v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)
  const isGeneric = /^Property \d+$/.test(label)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { if (!editing) setValue(label) }, [label, editing])
  function commit() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== label) onRename(id, trimmed)
    else setValue(label)
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(label); setEditing(false) } }}
        className="text-xs font-semibold text-gray-700 bg-white border border-blue-400 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
        maxLength={60}
      />
    )
  }
  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className={`text-left w-full group flex items-center gap-1 ${isGeneric ? 'text-blue-500 hover:text-blue-700' : 'text-xs font-semibold text-gray-700 hover:text-blue-600'} transition-colors`}
    >
      {isGeneric ? (
        <span className="text-[11px] font-semibold flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z" />
          </svg>
          Tap to name this property
        </span>
      ) : (
        <>
          <span className="truncate text-xs font-semibold">{label}</span>
          <svg className="w-3 h-3 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6 3 3-6 6H9v-3z" />
          </svg>
        </>
      )}
    </button>
  )
}

interface RowProps {
  label: string
  values: (React.ReactNode)[]
  highlight?: number
  lowlight?: number
  section?: boolean
  colCount?: number
}

function Row({ label, values, highlight, lowlight, section, colCount }: RowProps) {
  if (section) {
    return (
      <tr>
        <td colSpan={1 + (colCount ?? values.length)} className="px-4 pt-5 pb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        </td>
      </tr>
    )
  }
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white min-w-[120px] z-[1]">
        {label}
      </td>
      {values.map((val, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm text-center transition-colors ${
            i === highlight ? 'bg-green-50' : i === lowlight ? 'bg-red-50' : ''
          }`}
        >
          {val ?? <span className="text-gray-300">—</span>}
        </td>
      ))}
    </tr>
  )
}

export default function ComparisonView({ saved, onRemove, onRename, onBack, onClear, onAddAnother }: Props) {
  const [flagsExpanded, setFlagsExpanded] = useState(false)
  const n = saved.length

  const scores = saved.map((s) => s.result.finalScore)
  const scoreBest = bestIdx(scores)
  const scoreWorst = worstIdx(scores)

  const riskRanks = saved.map((s) => riskRank(s.result.riskLevel))
  const riskBest = bestIdx(riskRanks.map((r) => -r))
  const riskWorst = bestIdx(riskRanks)

  const yields = saved.map((s) => parseNumber(s.propertyData?.estimatedYield))
  const yieldBest = bestIdx(yields)
  const yieldWorst = worstIdx(yields)

  const categories = saved[0]?.result.categoryScores.map((c) => c.name) ?? []
  const summary = buildSummary(saved)

  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  const delta = maxScore - minScore

  const hasPropertyData = saved.some((s) => s.propertyData)
  const allFlags = saved.map((s) => s.propertyData?.flags ?? [])
  const maxFlags = Math.max(...allFlags.map((f) => f.length))

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="text-lg font-bold text-gray-900">Property Comparison</h2>
        <button
          onClick={onClear}
          className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Summary verdict line */}
      {summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800 leading-relaxed font-medium">{summary}</p>
        </div>
      )}

      {/* Property header cards */}
      <div className={`grid gap-3 ${n === 3 ? 'grid-cols-3' : n === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {saved.map((p, idx) => {
          const isWinner = scoreBest === idx
          const flagCount = p.propertyData?.flags?.length ?? 0
          const scoreColor =
            p.result.finalScore >= 70 ? 'border-green-300 bg-green-50' :
            p.result.finalScore >= 50 ? 'border-amber-300 bg-amber-50' :
            'border-red-300 bg-red-50'
          const scoreText =
            p.result.finalScore >= 70 ? 'text-green-700' :
            p.result.finalScore >= 50 ? 'text-amber-700' :
            'text-red-700'
          return (
            <div key={p.id} className={`rounded-2xl border-2 ${scoreColor} p-4 relative`}>
              {isWinner && n > 1 && (
                <div className="absolute -top-2.5 left-3 bg-amber-400 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                  <span>★</span> Best overall
                </div>
              )}
              <button
                onClick={() => onRemove(p.id)}
                className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
                aria-label="Remove"
              >
                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className={`text-3xl font-extrabold tabular-nums ${scoreText} mb-0.5 mt-1`}>{p.result.finalScore}</p>
              {n > 1 && delta > 0 && (
                isWinner
                  ? <span className="inline-block text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full mb-1">+{delta} pts lead</span>
                  : <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full mb-1">−{delta} pts behind</span>
              )}
              {n <= 1 && <p className="text-[10px] text-gray-400 mb-1">out of 100</p>}
              <div className="flex items-center gap-2 mb-2 mt-0.5">
                {flagCount > 0 ? (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    {flagCount} risk flag{flagCount !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                    No risk flags
                  </span>
                )}
              </div>
              <EditableLabel id={p.id} label={p.label} onRename={onRename} />
              {p.propertyData?.address && (
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed line-clamp-2" title={p.propertyData.address}>
                  {p.propertyData.address}
                </p>
              )}
            </div>
          )
        })}
        {n < 3 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 flex flex-col items-center justify-center gap-3 text-gray-300 min-h-[120px]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <button
              onClick={onAddAnother}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-all"
            >
              Analyse another property →
            </button>
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div className="rounded-2xl border border-gray-200 shadow-sm overflow-clip bg-white">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[400px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left min-w-[120px]" />
                {saved.map((p) => (
                  <th key={p.id} className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center max-w-[200px]">
                    <span className="block text-xs font-bold text-gray-700 truncate whitespace-nowrap">{p.label}</span>
                    {p.propertyData?.address && (
                      <span className="block text-[10px] font-normal text-gray-400 truncate whitespace-nowrap mt-0.5" title={p.propertyData.address}>
                        {p.propertyData.address}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Overall" values={saved.map(() => null)} section colCount={n} />
              <Row
                label="Overall score"
                values={saved.map((s) => <ScoreBadge key={s.id} score={s.result.finalScore} />)}
                highlight={scoreBest}
                lowlight={scoreWorst}
              />
              <Row
                label="Risk level"
                values={saved.map((s) => <RiskBadge key={s.id} risk={s.result.riskLevel} />)}
                highlight={riskBest}
                lowlight={riskWorst}
              />
              <Row
                label="Verdict"
                values={saved.map((s) => (
                  <span key={s.id} className="text-xs text-gray-600">{s.result.verdict}</span>
                ))}
              />

              {hasPropertyData && (
                <>
                  <Row label="Property Info" values={saved.map(() => null)} section colCount={n} />
                  <Row
                    label="Price"
                    values={saved.map((s) => (
                      <span key={s.id} className="text-sm font-semibold text-gray-800">
                        {s.propertyData?.price || '—'}
                      </span>
                    ))}
                  />
                  <Row
                    label="Est. yield"
                    values={saved.map((s) => (
                      <span key={s.id} className={`text-sm font-semibold ${yieldBest !== -1 && saved.indexOf(s) === yieldBest ? 'text-green-700' : 'text-gray-800'}`}>
                        {s.propertyData?.estimatedYield || '—'}
                      </span>
                    ))}
                    highlight={yieldBest}
                    lowlight={yieldWorst}
                  />
                  <Row
                    label="Rent estimate"
                    values={saved.map((s) => (
                      <span key={s.id} className="text-sm text-gray-700">{s.propertyData?.rentRange || '—'}</span>
                    ))}
                  />
                  <Row
                    label="Beds / Baths"
                    values={saved.map((s) => {
                      const b = s.propertyData?.bedrooms
                      const ba = s.propertyData?.bathrooms
                      const pk = s.propertyData?.parking
                      if (!b && !ba) return <span key={s.id} className="text-gray-300">—</span>
                      return (
                        <span key={s.id} className="text-sm text-gray-700">
                          {[b, ba, pk].filter(Boolean).join(' / ')}
                        </span>
                      )
                    })}
                  />
                  <Row
                    label="Land size"
                    values={saved.map((s) => (
                      <span key={s.id} className="text-sm text-gray-700">{s.propertyData?.landSize || '—'}</span>
                    ))}
                  />
                  <Row
                    label="Year built"
                    values={saved.map((s) => (
                      <span key={s.id} className="text-sm text-gray-700">{s.propertyData?.yearBuilt || '—'}</span>
                    ))}
                  />
                  {maxFlags > 0 && (
                    <>
                      <tr className="border-t border-gray-100">
                        <td className="px-4 py-3 sticky left-0 bg-white z-[1]">
                          <button
                            onClick={() => setFlagsExpanded((v) => !v)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                          >
                            <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${flagsExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            Risk flags
                          </button>
                        </td>
                        {saved.map((s) => {
                          const fc = s.propertyData?.flags?.length ?? 0
                          return (
                            <td key={s.id} className="px-4 py-3 text-center">
                              {fc > 0 ? (
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  {fc} flag{fc !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">None</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                      {flagsExpanded && (
                        <tr className="border-t border-dashed border-gray-100 bg-amber-50/40">
                          <td className="px-4 py-3 sticky left-0 bg-amber-50/40 z-[1]" />
                          {saved.map((s) => {
                            const flags = s.propertyData?.flags ?? []
                            return (
                              <td key={s.id} className="px-4 py-3 align-top">
                                {flags.length === 0 ? (
                                  <span className="text-xs text-green-600">None detected</span>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {flags.map((f, i) => (
                                      <li key={i} className="flex items-start gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                        <span className="text-xs text-amber-800 leading-relaxed">{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )}
                    </>
                  )}
                </>
              )}

              <Row label="Category Scores" values={saved.map(() => null)} section colCount={n} />
              {categories.map((catName) => {
                const catScores = saved.map((s) => {
                  const c = s.result.categoryScores.find((cs) => cs.name === catName)
                  return c?.answered ? c.score : null
                })
                const best = bestIdx(catScores)
                const worst = worstIdx(catScores)
                return (
                  <Row
                    key={catName}
                    label={catName}
                    values={catScores.map((score, i) => {
                      if (score === null) return <span key={i} className="text-gray-300">—</span>
                      return <MiniBar key={i} score={score} />
                    })}
                    highlight={best}
                    lowlight={worst}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 justify-center text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-200" />
          Best in comparison
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
          Needs attention
        </span>
        <span className="flex items-center gap-1.5 italic text-gray-300">
          Click label to rename
        </span>
      </div>
    </div>
  )
}
