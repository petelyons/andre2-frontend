import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Andre2',
  description: 'Andre2 is a music sharing app that allows you to share music with your friends.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
