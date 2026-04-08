'use client'

import { useState, useEffect } from 'react'
import { ConversationSignals, OptionScore, PropertyData, PropertyExtractResult } from '@/lib/types'

interface Props {
  onPrefill: (signals: ConversationSignals) => void
}

interface RiskItem {
  id: string
  label: string
  detect: (text: string) => boolean
  prefills: Record<string, OptionScore>
}

const RISK_ITEMS: RiskItem[] = [
  {
    id: 'sloped',
    label: 'Sloped land',
    detect: (t) => /steep\s*slope|sloped?\s*(?:land|block)|sloping|hillside/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'easement',
    label: 'Easement present',
    detect: (t) => /easement|right[\s-]of[\s-]way|encumbrance|r\.o\.w/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'public_housing',
    label: 'Near public housing',
    detect: (t) => /public\s*housing|housing\s*commission|commission\s*home|social\s*housing/i.test(t),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'main_road',
    label: 'Close to main road',
    detect: (t) => /main\s*road|arterial(?:\s*road)?|busy\s*road|high[\s-]traffic/i.test(t),
    prefills: { pr_2: 6 as OptionScore },
  },
  {
    id: 'irregular',
    label: 'Irregular land shape',
    detect: (t) => /irregular\s*(?:block|shape|land)|battle[\s-]?axe|flag\s*lot/i.test(t),
    prefills: { pa_2: 2 as OptionScore },
  },
  {
    id: 'power_lines',
    label: 'Near power lines',
    detect: (t) => /transmission\s*line|power\s*lines?|high[- ]?voltage|pylon|electricity\s*tower/i.test(t),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'old_property',
    label: 'Old property (40+ years)',
    detect: (t) => {
      const m = t.match(/(?:built|constructed|circa)\s*(?:in\s+)?(\d{4})\b/i)
      if (!m?.[1]) return false
      return new Date().getFullYear() - parseInt(m[1]) > 40
    },
    prefills: { pr_1: 6 as OptionScore },
  },
]

const PD_DISPLAY: { key: keyof PropertyData; label: string }[] = [
  { key: 'address', label: 'Address' },
  { key: 'price', label: 'Asking price' },
  { key: 'landSize', label: 'Land size' },
  { key: 'yearBuilt', label: 'Year built' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'parking', label: 'Parking' },
  { key: 'rentRange', label: 'Est. rent' },
  { key: 'estimatedYield', label: 'Est. yield' },
]

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

export default function PropertyLinkInput({ onPrefill }: Props) {
  const [addressOrUrl, setAddressOrUrl] = useState('')
  const [listingText, setListingText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<(PropertyExtractResult & { scrapedOk?: boolean }) | null>(null)
  const [detectedRisks, setDetectedRisks] = useState<Set<string>>(new Set())
  const [checkedRisks, setCheckedRisks] = useState<Set<string>>(new Set())

  const isUrl = /^https?:\/\//i.test(addressOrUrl.trim())
  const combinedDetectText = [addressOrUrl, listingText].join(' ')

  // Auto-detect risks from typed text in real-time
  useEffect(() => {
    const detected = new Set(RISK_ITEMS.filter((r) => r.detect(combinedDetectText)).map((r) => r.id))
    setDetectedRisks(detected)
    if (detected.size > 0) {
      setCheckedRisks((prev) => {
        const next = new Set(prev)
        detected.forEach((id) => next.add(id))
        return next
      })
    }
  }, [combinedDetectText])

  // After extraction: also detect from API-returned flags
  useEffect(() => {
    if (!result?.propertyData?.flags) return
    const flagText = result.propertyData.flags.join(' ')
    const fromFlags = new Set(RISK_ITEMS.filter((r) => r.detect(flagText)).map((r) => r.id))
    if (fromFlags.size > 0) {
      setDetectedRisks((prev) => { const n = new Set(prev); fromFlags.forEach((id) => n.add(id)); return n })
      setCheckedRisks((prev) => { const n = new Set(prev); fromFlags.forEach((id) => n.add(id)); return n })
    }
  }, [result])

  function toggleRisk(id: string) {
    setCheckedRisks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function resetResult() {
    setResult(null)
    setError('')
  }

  function handleAddressChange(val: string) {
    setAddressOrUrl(val)
    if (result) resetResult()
  }

  function handleListingTextChange(val: string) {
    setListingText(val)
    if (result) resetResult()
  }

  const canExtract = addressOrUrl.trim().length >= 5 || listingText.trim().length >= 20 || checkedRisks.size > 0

  async function handleExtract() {
    if (!canExtract) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/property-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressOrUrl: addressOrUrl.trim(), listingText: listingText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract property details. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!result) return
    const riskPrefills = buildRiskPrefills(checkedRisks)
    const merged: Record<string, OptionScore> = { ...result.prefills }
    for (const [k, v] of Object.entries(riskPrefills)) {
      const cur = merged[k]
      if (cur === undefined || v < cur) merged[k] = v as OptionScore
    }
    const checkedLabels = RISK_ITEMS.filter((r) => checkedRisks.has(r.id)).map((r) => r.label)
    const riskNote = checkedLabels.length > 0 ? `\n\nConfirmed risk flags: ${checkedLabels.join(', ')}.` : ''
    onPrefill({
      prefills: merged,
      summary: result.summary,
      rawText: (result.rawText ?? '') + riskNote,
    })
  }

  const pd = result?.propertyData
  const dataRows = pd ? PD_DISPLAY.filter(({ key }) => pd[key] && typeof pd[key] === 'string') : []
  const prefillCount = result ? Object.keys(result.prefills).length : 0

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
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
        {/* Address / URL input */}
        <div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Enter a property address or paste a listing URL &mdash; we&rsquo;ll try to fetch it automatically.
          </p>
          <div className="relative">
            <input
              type="text"
              value={addressOrUrl}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="e.g.  42 Main St, Richmond VIC  or  domain.com.au/property/..."
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300 pr-28"
            />
            {isUrl && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full pointer-events-none">
                URL detected
              </span>
            )}
          </div>
        </div>

        {/* Listing text textarea */}
        <div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Paste a property listing, agent notes, or description. Risks will be auto-detected below.
          </p>
          <textarea
            value={listingText}
            onChange={(e) => handleListingTextChange(e.target.value)}
            placeholder="Paste listing details, agent notes, or any property description…"
            rows={5}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
          />
        </div>

        {/* Risk checklist */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Detected Property Risks</p>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            {detectedRisks.size > 0
              ? "We've identified potential risks based on your input. Adjust if needed."
              : "Know of any property risks? Check them below — they'll influence your score."}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {RISK_ITEMS.map((risk) => {
              const isChecked = checkedRisks.has(risk.id)
              const isDetected = detectedRisks.has(risk.id)
              return (
                <div
                  key={risk.id}
                  onClick={() => toggleRisk(risk.id)}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
                    isChecked
                      ? 'bg-amber-500 border-amber-500'
                      : 'border-amber-300 group-hover:border-amber-400 bg-white'
                  }`}>
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-xs transition-colors duration-150 ${isChecked ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                    {risk.label}
                  </span>
                  {isDetected && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full ml-auto">
                      detected
                    </span>
                  )}
                </div>
              )
            })}
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

        {/* Extracted data preview */}
        {result && !error && (
          <div className="space-y-3">
            {result.scrapedOk && (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Listing fetched from URL automatically
              </p>
            )}

            {(dataRows.length > 0 || (pd?.flags && pd.flags.length > 0)) && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Extracted Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {dataRows.map(({ key, label }) => (
                    <div key={key}>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-800">{pd![key] as string}</p>
                    </div>
                  ))}
                </div>
                {pd?.flags && pd.flags.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold mb-2">Risk flags detected</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pd.flags.map((flag) => (
                        <span key={flag} className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                ✓ {prefillCount} answer{prefillCount !== 1 ? 's' : ''} ready to pre-fill
              </p>
              {result.summary && (
                <p className="text-sm text-gray-600 leading-relaxed">{result.summary}</p>
              )}
              {prefillCount < 8 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Some answers estimated from limited data — adjust in the review step.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!result ? (
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
                {isUrl ? 'Fetching & analysing…' : 'Extracting details…'}
              </>
            ) : (
              isUrl ? 'Fetch & Pre-fill Answers' : 'Extract & Pre-fill Answers'
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleApply}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-sm font-semibold text-white transition-all duration-200 shadow-sm"
            >
              Use These Pre-filled Answers
            </button>
            <button
              onClick={resetResult}
              className="w-full py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150"
            >
              Re-enter details
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
