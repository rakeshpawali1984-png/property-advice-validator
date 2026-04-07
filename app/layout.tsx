import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Buyer Agent Scorecard',
  description: 'Evaluate your buyer\'s agent with a structured, AI-powered scorecard.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
