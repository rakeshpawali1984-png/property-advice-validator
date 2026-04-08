'use client'

import { useState, useEffect, useRef } from 'react'
import { ConversationSignals, OptionScore } from '@/lib/types'

interface Props {
  onPrefill: (signals: ConversationSignals) => void
}

// ── Risk data ──────────────────────────────────────────────────────────────────

type RiskGroup = 'physical' | 'location' | 'planning' | 'environmental' | 'market'

interface RiskItem {
  id: string
  label: string
  group: RiskGroup
  tooltip: string
  detect: (text: string) => boolean
  prefills: Record<string, OptionScore>
}

// Returns true only if the pattern matches AND the match is NOT preceded by a
// negation word (no, not, without, never, none) within the same clause.
// Prevents false positives from phrases like "No public housing nearby" or
// "Not near main road or railway".
function isConfirmedRisk(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 60), m.index)
    // Skip if a negation word appears before this match in the same clause
    if (/\b(no|not|without|never|none|free\s+from)\b[^.!?\n]*$/i.test(before)) continue
    return true
  }
  return false
}

const RISK_ITEMS: RiskItem[] = [
  // PHYSICAL
  {
    id: 'sloped',
    label: 'Sloped land',
    group: 'physical',
    tooltip: 'May limit development potential and resale appeal',
    detect: (t) => /steep\s*slope|sloped?\s*(?:land|block)|sloping|hillside|land\s*slope[s]?\s*:\s*yes/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'irregular',
    label: 'Irregular land shape',
    group: 'physical',
    tooltip: 'Can reduce usable area and limit build options',
    detect: (t) => /irregular\s*(?:block|shape|land)|battle[\s-]?axe|flag\s*lot|land\s*shape\s*:\s*irregular/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'old_property',
    label: 'Old property (40+ years)',
    group: 'physical',
    tooltip: 'May require significant maintenance; can affect loan terms',
    detect: (t) => {
      const patterns = [
        /(?:year\s*built|built|constructed|circa)[:\s]+(\d{4})\b/i,
        /\b(19[0-8]\d|190\d)\b/,
      ]
      for (const p of patterns) {
        const m = t.match(p)
        if (m?.[1] && new Date().getFullYear() - parseInt(m[1]) > 40) return true
      }
      return false
    },
    prefills: { pr_1: 6 as OptionScore },
  },
  {
    id: 'structural',
    label: 'Structural concerns',
    group: 'physical',
    tooltip: 'Can be costly to remediate and may deter future buyers',
    detect: (t) => /structural\s*(?:issue|concern|problem|damage)|foundation\s*(?:issue|crack|problem)|subsidence|underpinning/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  // LOCATION
  {
    id: 'public_housing',
    label: 'Near public housing',
    group: 'location',
    tooltip: 'May affect tenant quality and buyer demand',
    detect: (t) => isConfirmedRisk(t, /public\s*housing|housing\s*commission|commission\s*home|social\s*housing/i),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'main_road',
    label: 'Close to main road / highway',
    group: 'location',
    tooltip: 'Traffic noise and safety concerns can reduce desirability',
    detect: (t) => isConfirmedRisk(t, /main\s*road|arterial(?:\s*road)?|busy\s*road|high[\s-]traffic|along\s*highways?/i),
    prefills: { pr_2: 6 as OptionScore },
  },
  {
    id: 'railway',
    label: 'Near railway tracks',
    group: 'location',
    tooltip: 'Noise and vibration may reduce tenant satisfaction',
    detect: (t) => isConfirmedRisk(t, /railway|train\s*(?:line|track|station)|rail\s*(?:corridor|line|track)/i),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'industrial',
    label: 'Near industrial / commercial',
    group: 'location',
    tooltip: 'Affects liveability and can suppress residential values',
    detect: (t) => /industrial\s*(?:area|zone|estate)|commercial\s*zone|factory\s*nearby|warehouse\s*nearby|near\s*infrastructures?\s*:\s*yes/i.test(t),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'power_lines',
    label: 'Near power lines / transmission',
    group: 'location',
    tooltip: 'Health perception and visual impact can reduce resale value',
    detect: (t) => isConfirmedRisk(t, /transmission\s*line|power\s*lines?|high[- ]?voltage|pylon|electricity\s*tower/i),
    prefills: { pr_2: 2 as OptionScore },
  },
  // PLANNING & LEGAL
  {
    id: 'easement',
    label: 'Easement present',
    group: 'planning',
    tooltip: 'Limits what you can build and may complicate future sales',
    detect: (t) => /easement[:\s]*yes|right[\s-]of[\s-]way|encumbrance|r\.o\.w|\beasement\b.*\byes\b/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'heritage',
    label: 'Heritage overlay',
    group: 'planning',
    tooltip: 'Restricts renovations and may increase compliance costs',
    detect: (t) => isConfirmedRisk(t, /heritage\s*(?:overlay|listed|register|zone|property)/i),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'zoning',
    label: 'Zoning restrictions',
    group: 'planning',
    tooltip: 'May prevent subdivision or limit development upside',
    detect: (t) => /zoning\s*restrict|restrictive\s*zon|cannot\s*subdivide|zoning\s*:\s*restrict/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'shared_access',
    label: 'Shared driveway / access',
    group: 'planning',
    tooltip: 'Can create neighbour disputes and reduce buyer pool',
    detect: (t) => /shared\s*driveway|shared\s*access|right\s*of\s*way.*driveway/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  // ENVIRONMENTAL
  {
    id: 'flood',
    label: 'Flood zone',
    group: 'environmental',
    tooltip: 'May increase insurance costs and impact resale value',
    detect: (t) => isConfirmedRisk(t, /flood\s*(?:zone|plain|risk|area|prone)|prone\s*to\s*flood|inundation/i),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'bushfire',
    label: 'Bushfire zone',
    group: 'environmental',
    tooltip: 'Higher insurance premiums and building restrictions apply',
    detect: (t) => isConfirmedRisk(t, /bushfire\s*(?:zone|risk|area)|BAL[-\s]\d|prone\s*to\s*(?:bush)?fire/i),
    prefills: { pa_2: 2 as OptionScore },
  },
  // MARKET
  {
    id: 'high_supply',
    label: 'High land supply area',
    group: 'market',
    tooltip: 'May limit capital growth due to excess inventory',
    detect: (t) => /high\s*(?:supply|land\s*supply)|oversupply|large\s*land\s*release|high\s*supply\s*ratio\s*:\s*yes/i.test(t),
    prefills: { pr_1: 6 as OptionScore },
  },
  {
    id: 'low_rental',
    label: 'Low rental demand',
    group: 'market',
    tooltip: 'Vacancy risk can erode yield and cashflow',
    detect: (t) => /low\s*rental\s*(?:demand|yield)|high\s*(?:rental\s*)?vacancy|hard\s*to\s*rent/i.test(t),
    prefills: { pr_1: 6 as OptionScore },
  },
]

const RISK_GROUPS: { id: RiskGroup; label: string; dotColor: string }[] = [
  { id: 'physical',      label: 'Physical',         dotColor: 'bg-orange-400' },
  { id: 'location',      label: 'Location',          dotColor: 'bg-rose-400' },
  { id: 'planning',      label: 'Planning & Legal',  dotColor: 'bg-purple-400' },
  { id: 'environmental', label: 'Environmental',     dotColor: 'bg-cyan-500' },
  { id: 'market',        label: 'Market',            dotColor: 'bg-indigo-400' },
]

// ── Score builder (unchanged logic) ───────────────────────────────────────────

function buildRiskPrefills(checkedIds: Set<string>): Record<string, OptionScore> {
  const out: Record<string, OptionScore> = {}
  for (const risk of RISK_ITEMS) {
    if (!checkedIds.has(risk.id)) continue
    for (const [qId, score] of Object.entries(risk.prefills)) {
      const cur = out[qId]
      if (cur === undefined || score < cur) out[qId] = score as OptionScore
    }
  }
  return out
}

// ── Tooltip + Risk row ─────────────────────────────────────────────────────────

function InfoIcon({ riskId, activeId, onToggle }: {
  riskId: string
  activeId: string | null
  onToggle: (id: string | null) => void
}) {
  const isActive = activeId === riskId
  return (
    <button
      type="button"
      onMouseEnter={() => onToggle(riskId)}
      onMouseLeave={() => onToggle(null)}
      onClick={(e) => { e.stopPropagation(); onToggle(isActive ? null : riskId) }}
      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
        isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-300 hover:text-blue-400'
      }`}
      aria-label="More info"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    </button>
  )
}

interface RiskRowProps {
  risk: RiskItem
  isChecked: boolean
  isDetected: boolean
  tooltipId: string | null
  flashId: string | null
  onToggle: (id: string) => void
  onTooltipToggle: (id: string | null) => void
}

function RiskRow({ risk, isChecked, isDetected, tooltipId, flashId, onToggle, onTooltipToggle }: RiskRowProps) {
  const showTooltip = tooltipId === risk.id
  const showFlash = flashId === risk.id && isChecked

  return (
    <div className="relative">
      <div className="flex items-center gap-2 py-1">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(risk.id)}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
            isChecked
              ? 'bg-amber-500 border-amber-500'
              : 'border-gray-300 hover:border-amber-400 bg-white'
          }`}
          aria-label={`Toggle ${risk.label}`}
        >
          {isChecked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Label */}
        <span
          onClick={() => onToggle(risk.id)}
          className={`text-xs flex-1 cursor-pointer select-none transition-colors ${
            isChecked ? 'text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {risk.label}
        </span>

        {/* Detected badge */}
        {isDetected && (
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full shrink-0">
            detected
          </span>
        )}

        {/* Info icon */}
        <InfoIcon riskId={risk.id} activeId={tooltipId} onToggle={onTooltipToggle} />
      </div>

      {/* Tooltip */}
      {showTooltip && !showFlash && (
        <div className="mx-6 mb-1 px-2.5 py-1.5 bg-gray-800 text-white text-[11px] rounded-lg leading-relaxed pointer-events-none">
          {risk.tooltip}
          <div className="absolute left-7 -top-1.5 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800" />
        </div>
      )}

      {/* Flash explanation (on check) */}
      {showFlash && (
        <div className="mx-6 mb-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg leading-relaxed animate-pulse">
          {risk.tooltip}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PropertyLinkInput({ onPrefill }: Props) {
  const [listingText, setListingText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detectedRisks, setDetectedRisks] = useState<Set<string>>(new Set())
  const [checkedRisks, setCheckedRisks] = useState<Set<string>>(new Set())
  const [showMoreRisks, setShowMoreRisks] = useState(false)
  const [tooltipId, setTooltipId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-detect risks from text in real-time
  useEffect(() => {
    const detected = new Set(RISK_ITEMS.filter((r) => r.detect(listingText)).map((r) => r.id))
    setDetectedRisks(detected)
    if (detected.size > 0) {
      setCheckedRisks((prev) => {
        const next = new Set(prev)
        detected.forEach((id) => next.add(id))
        return next
      })
    }
  }, [listingText])

  function toggleRisk(id: string) {
    setCheckedRisks((prev) => {
      const next = new Set(prev)
      const wasChecked = next.has(id)
      wasChecked ? next.delete(id) : next.add(id)
      // Flash tooltip briefly on check
      if (!wasChecked) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        setFlashId(id)
        flashTimerRef.current = setTimeout(() => setFlashId(null), 1500)
      }
      return next
    })
  }

  const canExtract = listingText.trim().length >= 20 || checkedRisks.size > 0

  async function handleExtract() {
    if (!canExtract) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/property-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingText: listingText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }
      const data = await res.json()
      const riskPrefills = buildRiskPrefills(checkedRisks)
      const merged: Record<string, OptionScore> = { ...data.prefills }
      for (const [k, v] of Object.entries(riskPrefills)) {
        const cur = merged[k]
        if (cur === undefined || v < cur) merged[k] = v as OptionScore
      }
      const checkedLabels = RISK_ITEMS.filter((r) => checkedRisks.has(r.id)).map((r) => r.label)
      const riskNote = checkedLabels.length > 0 ? `\n\nConfirmed risk flags: ${checkedLabels.join(', ')}.` : ''
      onPrefill({
        prefills: merged,
        summary: data.summary,
        rawText: (data.rawText ?? '') + riskNote,
        propertyData: data.propertyData,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract property details. Check your API key.')
      setLoading(false)
    }
  }

  // Risks split into detected and additional
  const detectedRiskItems = RISK_ITEMS.filter((r) => detectedRisks.has(r.id))
  const additionalRiskItems = RISK_ITEMS.filter((r) => !detectedRisks.has(r.id))
  const manuallyCheckedAdditional = additionalRiskItems.filter((r) => checkedRisks.has(r.id))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-clip hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-800">Property Details & Risk Flags</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">optional</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Paste listing text */}
        <div>
          <p className="text-xs text-gray-500 mb-1 leading-relaxed">
            Paste a property listing, agent notes, or description. Risks will be auto-detected below.
          </p>
          <p className="text-xs text-blue-500 mb-2 leading-relaxed">
            Tip: open the listing in your browser, select all text (Cmd+A), copy and paste here.
          </p>
          <textarea
            value={listingText}
            onChange={(e) => setListingText(e.target.value)}
            placeholder="Paste listing details, agent notes, or any property description…"
            rows={6}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
          />
          {listingText.length > 0 && listingText.trim().length < 20 && (
            <p className="text-xs text-gray-400 mt-1.5">
              {20 - listingText.trim().length} more character{20 - listingText.trim().length !== 1 ? 's' : ''} needed to enable analysis
            </p>
          )}
        </div>

        {/* ── Risk checklist ── */}
        <div className="border border-amber-100 rounded-xl overflow-clip">
          {/* Section header */}
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex-1">
              Property Risks
            </p>
            {detectedRisks.size > 0 && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                {detectedRisks.size} auto-detected
              </span>
            )}
          </div>

          <div className="px-4 py-3 space-y-0.5">
            {/* Detected risks */}
            {detectedRiskItems.length > 0 ? (
              <>
                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest font-semibold">Detected from your input</p>
                {detectedRiskItems.map((risk) => (
                  <RiskRow
                    key={risk.id}
                    risk={risk}
                    isChecked={checkedRisks.has(risk.id)}
                    isDetected={true}
                    tooltipId={tooltipId}
                    flashId={flashId}
                    onToggle={toggleRisk}
                    onTooltipToggle={setTooltipId}
                  />
                ))}
              </>
            ) : (
              <p className="text-xs text-gray-400 py-1">
                No risks auto-detected yet. Add your listing text above, or select manually below.
              </p>
            )}

            {/* Divider + "add more" toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowMoreRisks((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors py-1 w-full"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showMoreRisks ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {showMoreRisks ? 'Hide additional risks' : (
                  <>
                    Add more risks if applicable
                    {manuallyCheckedAdditional.length > 0 && (
                      <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        {manuallyCheckedAdditional.length} selected
                      </span>
                    )}
                  </>
                )}
              </button>

              {showMoreRisks && (
                <div className="mt-2 space-y-3 border-t border-gray-100 pt-3">
                  {RISK_GROUPS.map((group) => {
                    const items = additionalRiskItems.filter((r) => r.group === group.id)
                    if (items.length === 0) return null
                    return (
                      <div key={group.id}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${group.dotColor} shrink-0`} />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{group.label}</p>
                        </div>
                        <div className="space-y-0.5 pl-1">
                          {items.map((risk) => (
                            <RiskRow
                              key={risk.id}
                              risk={risk}
                              isChecked={checkedRisks.has(risk.id)}
                              isDetected={false}
                              tooltipId={tooltipId}
                              flashId={flashId}
                              onToggle={toggleRisk}
                              onTooltipToggle={setTooltipId}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your data is private. Not stored or shared.
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleExtract}
          disabled={loading || !canExtract}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analysing property…
            </>
          ) : (
            'Analyse Property'
          )}
        </button>
      </div>
    </div>
  )
}
