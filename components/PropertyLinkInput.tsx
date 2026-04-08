'use client'

import { useState } from 'react'
import { ConversationSignals, PropertyData, PropertyExtractResult } from '@/lib/types'

interface Props {
  onPrefill: (signals: ConversationSignals) => void
}

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

export default function PropertyLinkInput({ onPrefill }: Props) {
  const [input, setInput] = useState('')
  const [listingText, setListingText] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PropertyExtractResult | null>(null)

  const canExtract = input.trim().length >= 5

  function handleInputChange(val: string) {
    setInput(val)
    if (result) setResult(null)
  }

  function handleListingTextChange(val: string) {
    setListingText(val)
    if (result) setResult(null)
  }

  async function handleExtract() {
    if (!canExtract) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/property-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressOrUrl: input.trim(), listingText: listingText.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Request failed')
      }
      const data: PropertyExtractResult = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract property details. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!result) return
    onPrefill({
      prefills: result.prefills,
      summary: result.summary,
      rawText: result.rawText,
    })
  }

  const pd = result?.propertyData
  const dataRows = pd
    ? PD_DISPLAY.filter(({ key }) => pd[key] && typeof pd[key] === 'string')
    : []
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
        <h3 className="text-sm font-semibold text-gray-800">Property Link or Address</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">optional</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Address / URL input */}
        <div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Enter a property address or paste a listing URL. Add the listing text below for a richer extraction.
          </p>
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="e.g.  42 Main St, Richmond VIC 3121  or  domain.com.au/property/..."
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
          />
        </div>

        {/* Optional listing text */}
        <div>
          <button
            onClick={() => setShowExtra(!showExtra)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5 font-medium transition-colors duration-150"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-150 ${showExtra ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {showExtra ? 'Hide listing text' : 'Paste listing text for richer extraction (optional)'}
          </button>
          {showExtra && (
            <textarea
              value={listingText}
              onChange={(e) => handleListingTextChange(e.target.value)}
              placeholder="Paste the full listing description, features, price details, and any other text from the property page…"
              rows={5}
              className="mt-2 w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
            />
          )}
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
                &#10003; {prefillCount} answer{prefillCount !== 1 ? 's' : ''} ready to pre-fill
              </p>
              {result.summary && (
                <p className="text-sm text-gray-600 leading-relaxed">{result.summary}</p>
              )}
              {prefillCount < 8 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Some answers were estimated from limited data — you can adjust in the review step.
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
                Extracting details&hellip;
              </>
            ) : (
              'Extract & Pre-fill Answers'
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
              onClick={() => setResult(null)}
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
