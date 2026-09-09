import type { ReactNode } from 'react'
import './globals.css'
import './portal.css'
import { portalLang } from '@/lib/portal-lang'

export const metadata = {
  title: 'FCM — Frankonia Customer Management',
  description: 'Frankonia 고객관리 프로그램',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={await portalLang()}>
      <body>{children}</body>
    </html>
  )
}
