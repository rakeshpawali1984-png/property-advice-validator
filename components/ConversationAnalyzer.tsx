'use client'

import { useState } from 'react'
import { ConversationSignals, OptionScore } from '@/lib/types'

interface Props {
  onPrefill: (signals: ConversationSignals) => void
  contextType: 'agent' | 'property'
}

export default function ConversationAnalyzer({ onPrefill, contextType }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [prefillCount, setPrefillCount] = useState(0)
  const [analysed, setAnalysed] = useState(false)

  async function handleAnalyze() {
    if (text.trim().length < 20) {
      setError('Please paste a longer conversation (at least a few messages).')
      return
    }
    setLoading(true)
    setError('')
    setSummary('')
    setAnalysed(false)

    try {
      const res = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: text, contextType }),
      })
      if (!res.ok) throw new Error('Failed')
      const data: ConversationSignals = await res.json()
      const count = Object.keys(data.prefills).length
      setPrefillCount(count)
      setSummary(data.summary)
      setAnalysed(true)
      onPrefill({ ...data, rawText: text })
    } catch {
      setError('Could not analyse the conversation. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-base font-medium text-gray-800">Conversation Import</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">optional</span>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed">
          Paste a transcript, chat, or email exchange with your agent. Relevant answers will be identified and pre-filled automatically.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your conversation here… (e.g., WhatsApp chat, email thread)"
          rows={6}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 hover:border-gray-300"
        />

        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your data is private. Conversations are processed securely and not stored or shared.
        </p>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        {analysed && summary && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              ✓ {prefillCount} answer{prefillCount !== 1 ? 's' : ''} pre-filled from conversation
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || text.trim().length < 20}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all duration-200 shadow-sm flex items-center justify-center gap-2"
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
