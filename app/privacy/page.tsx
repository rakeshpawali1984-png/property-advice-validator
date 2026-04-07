import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Property Advice Validator',
  description: 'How we handle your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <span className="text-sm text-gray-400">Privacy Policy</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Simple and plain — no legal jargon.</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">What you provide</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            You may paste conversations, property details, or other text into this tool to get a structured assessment. This is the only information we receive from you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">How we use your data</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            The text you provide is sent to a language model to generate your assessment. It is used solely to produce the output you see on screen. We do not use it for training, advertising, or any other purpose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">Storage</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We do not store your conversations or any text you paste into the tool. Once your session ends, nothing is retained on our end. We do not use cookies or track behaviour across sessions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">Sharing</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            We do not sell, share, or disclose your data to any third parties — except to the language model provider as needed to process your request. That provider operates under its own privacy policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">Your responsibility</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Please avoid pasting sensitive personal information (e.g. full names, financial account numbers, legal documents) beyond what is needed to get useful advice. Use your judgement about what you share.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">Contact</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            If you have questions about how your data is handled, you can reach us via the feedback link on the main page. We'll respond as quickly as we can.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Last updated: April 2026</p>
        </div>
      </main>
    </div>
  )
}
