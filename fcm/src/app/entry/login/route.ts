import { NextRequest, NextResponse } from 'next/server'
import { portalLogin } from '@/lib/auth/portal'
import { SESSION_COOKIE } from '@/lib/auth/constants'

export async function POST(req: NextRequest) {
  const callbackOrigin = `http://127.0.0.1:${req.nextUrl.port || '3002'}`
  const origin = req.headers.get('origin')
  const allowed = new Set([req.nextUrl.origin, 'http://127.0.0.1:3002', 'https://junhan95.github.io'])
  if (!origin || !allowed.has(origin)) return new Response('Forbidden', { status: 403 })
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return new Response('Request too large', { status: 413 })
  const data = await req.formData()
  const loginId = String(data.get('loginId') ?? '')
  const password = String(data.get('password') ?? '')
  const lang = data.get('lang') === 'ko' ? 'ko' : 'en'
  if (!loginId || loginId.length > 128 || !password || password.length > 1024) {
    return NextResponse.redirect(new URL('/login?error=1', callbackOrigin), 303)
  }
  try {
    const result = await portalLogin({ loginId, password, userAgent: req.headers.get('user-agent') ?? undefined })
    if (!result.ok) return NextResponse.redirect(new URL(`/login?error=1&lang=${lang}`, callbackOrigin), 303)
    const response = NextResponse.redirect(new URL('/workspace', callbackOrigin), 303)
    response.cookies.delete('fct_session')
    response.cookies.set(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', path: '/', maxAge: 86400 })
    response.cookies.set('fcm_lang', lang, { sameSite: 'lax', path: '/', maxAge: 31536000 })
    response.cookies.set('fct_lang', lang, { sameSite: 'lax', path: '/', maxAge: 31536000 })
    return response
  } catch {
    return NextResponse.redirect(new URL(`/login?error=unavailable&lang=${lang}`, callbackOrigin), 303)
  }
}
