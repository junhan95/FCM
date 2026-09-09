'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/guard'
import { revokeSessionByToken, SESSION_COOKIE } from '@/lib/auth/session'
export async function languageAction(data: FormData) {
  const lang = data.get('lang') === 'ko' ? 'ko' : 'en'
  const jar = await cookies()
  for (const name of ['fcm_lang','fct_lang']) jar.set(name, lang, { path: '/', sameSite: 'lax', maxAge: 31536000 })
}
export async function signOut() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSessionByToken(token)
  jar.delete(SESSION_COOKIE)
  jar.delete('fct_session')
  redirect('/login')
}
export async function enterFct(data: FormData) {
  await requireSession()
  const port = Number(process.env.FCT_PORT ?? 3001)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid FCT_PORT')
  const destination = data.get('destination') === 'new' ? '/projects/new' : '/'
  const response = await fetch(`http://127.0.0.1:${port}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(3000) }).catch(() => null)
  const health = response?.ok ? await response.json().catch(() => null) : null
  if (health?.app !== 'fct' || !health?.fcmIntegration) redirect('/workspace/fct?offline=1')
  const jar = await cookies()
  jar.set('fct_lang', data.get('language') === 'ko' ? 'ko' : 'en', { path: '/', sameSite: 'lax', maxAge: 31536000 })
  redirect(`http://127.0.0.1:${port}${destination}`)
}
