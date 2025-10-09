import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WebSocket Chat App',
  description: 'A real-time chat application using WebSocket',
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
