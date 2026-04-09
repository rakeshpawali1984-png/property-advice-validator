'use client'

import { useState, useEffect } from 'react'
import { ConversationSignals, OptionScore } from '@/lib/types'

interface Props {
  onPrefill: (signals: ConversationSignals) => void
  contextType: 'agent' | 'property'
}

interface RiskItem {
  id: string
  label: string
  detect: (text: string) => boolean
  prefills: Record<string, OptionScore>
}

function isConfirmedRisk(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    // Get the full line containing this match
    const lineStart = text.lastIndexOf('\n', m.index) + 1
    const lineEnd = text.indexOf('\n', m.index + m[0].length)
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
    // Skip if line ends with a negation value (e.g. "Near railway tracks: No")
    if (/[:\-]\s*(no|none|n\/a|false|not\s+applicable)\s*$/i.test(line)) continue
    // Skip if a negation word appears before this match in the same clause
    const before = text.slice(Math.max(0, m.index - 60), m.index)
    if (/\b(no|not|without|never|none|free\s+from)\b[^.!?\n]*$/i.test(before)) continue
    return true
  }
  return false
}

function normalizeNegatedLines(text: string): string {
  return text.split('\n').map(line => {
    const m = line.match(/^(.+?)\s*[:\-]\s*(no|none|n\/a|false|nope|not\s+applicable|not\s+present|nil)\s*$/i)
    if (m) return `Not ${m[1].trim()}`
    return line
  }).join('\n')
}

const RISK_ITEMS: RiskItem[] = [
  {
    id: 'sloped',
    label: 'Sloped land',
    detect: (t) => isConfirmedRisk(t, /steep\s*slope|sloped?\s*(?:land|block)|sloping|hillside/i),
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
    detect: (t) => isConfirmedRisk(t, /public\s*housing|housing\s*commission|commission\s*home|social\s*housing/i),
    prefills: { pr_2: 2 as OptionScore },
  },
  {
    id: 'main_road',
    label: 'Close to main road',
    detect: (t) => isConfirmedRisk(t, /main\s*road|arterial(?:\s*road)?|busy\s*road|high[\s-]traffic/i),
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
    detect: (t) => isConfirmedRisk(t, /transmission\s*line|power\s*lines?|high[- ]?voltage|pylon|electricity\s*tower/i),
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

function buildRiskPrefills(checkedIds: Set<string>): Record<string, OptionScore> {
  const result: Record<string, OptionScore> = {}
  for (const risk of RISK_ITEMS) {
    if (!checkedIds.has(risk.id)) continue
    for (const [qId, score] of Object.entries(risk.prefills)) {
      const cur = result[qId]
      if (cur === undefined || score < cur) result[qId] = score
    }
  }
  return result
}

export default function ConversationAnalyzer({ onPrefill, contextType }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [prefillCount, setPrefillCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [analysed, setAnalysed] = useState(false)
  const [detectedRisks, setDetectedRisks] = useState<Set<string>>(new Set())
  const [checkedRisks, setCheckedRisks] = useState<Set<string>>(new Set())

  // Auto-detect risks from text (property mode only)
  useEffect(() => {
    if (contextType !== 'property') return
    const normalised = normalizeNegatedLines(text)
    const detected = new Set(RISK_ITEMS.filter((r) => r.detect(normalised)).map((r) => r.id))
    setDetectedRisks(detected)
    // Auto-check newly detected items — never auto-uncheck (user controls removal)
    if (detected.size > 0) {
      setCheckedRisks((prev) => {
        const next = new Set(prev)
        detected.forEach((id) => next.add(id))
        return next
      })
    }
  }, [text, contextType])

  function toggleRisk(id: string) {
    setCheckedRisks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hasText = text.trim().length >= 20
  const hasRisks = contextType === 'property' && checkedRisks.size > 0
  const canSubmit = hasText || hasRisks

  async function handleAnalyze() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setSummary('')
    setAnalysed(false)
        setRejectedCount(0)
    const riskPrefills = buildRiskPrefills(checkedRisks)
    const checkedLabels = RISK_ITEMS.filter((r) => checkedRisks.has(r.id)).map((r) => r.label)
    const riskNote = checkedLabels.length > 0
      ? `\n\n---\nConfirmed property risk flags: ${checkedLabels.join(', ')}.`
      : ''

    try {
      if (hasText) {
        const res = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation: text, contextType }),
        })
        if (!res.ok) throw new Error('Failed')
        const data: ConversationSignals = await res.json()

        // Merge: risk flags take lowest (worst) score when conflicting
        const merged: Record<string, OptionScore> = { ...data.prefills }
        for (const [k, v] of Object.entries(riskPrefills)) {
          const cur = merged[k]
          if (cur === undefined || v < cur) merged[k] = v
        }

        setPrefillCount(Object.keys(merged).length)
        setRejectedCount(data.rejectedCount ?? 0)
        setSummary(data.summary)
        setAnalysed(true)
        onPrefill({ ...data, prefills: merged, rawText: text + riskNote })
      } else {
        // Risk-only path (no text pasted)
        setPrefillCount(Object.keys(riskPrefills).length)
        setSummary('')
        setAnalysed(true)
        onPrefill({
          prefills: riskPrefills,
          summary: `Risk flags applied: ${checkedLabels.join(', ')}.`,
          rawText: riskNote.trim(),
        })
      }
    } catch {
      setError('Could not analyse the conversation. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  const isProperty = contextType === 'property'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-800">
          {isProperty ? 'Property Details & Risk Flags' : 'Conversation Import'}
        </h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">optional</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Textarea */}
        <div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            {isProperty
              ? 'Paste a property listing, agent notes, or description. Risks will be auto-detected below.'
              : 'Paste a transcript, chat, or email exchange with your agent. Answers will be pre-filled automatically.'}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isProperty
              ? 'Paste listing details, agent notes, or any property description…'
              : 'Paste your conversation here… (e.g., WhatsApp chat, email thread)'}
            rows={5}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
          />
          {text.length > 0 && !hasText && (
            <p className="text-xs text-gray-400 mt-1.5">
              {20 - text.trim().length} more character{20 - text.trim().length !== 1 ? 's' : ''} needed to enable import
            </p>
          )}
        </div>

        {/* Risk checklist — property mode only */}
        {isProperty && (
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
                : 'Know of any property risks? Check them below — they\'ll influence your score.'}
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
                      <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
                        detected
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your data is private. Not stored or shared.
        </p>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        {analysed && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              ✓ {prefillCount} answer{prefillCount !== 1 ? 's' : ''} pre-filled
            </p>
            {rejectedCount > 0 && (
              <p className="text-xs text-amber-700 mb-1">
                {rejectedCount} response{rejectedCount !== 1 ? 's' : ''} from AI were unclear and ignored
              </p>
            )}
            {summary && <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || !canSubmit}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Extracting signals…
            </>
          ) : (
            'Import & Pre-fill Answers'
          )}
        </button>
      </div>
    </div>
  )
}
