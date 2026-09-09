import { timingSafeEqual } from 'node:crypto'
import { resolveSession, revokeSessionByToken } from '@/lib/auth/session'

export async function POST(req: Request) {
  const secret = process.env.FCM_BRIDGE_SECRET
  const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  if (!secret || secret.length < 32 || Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body.token !== 'string' || body.token.length > 256) return Response.json({ error: 'invalid' }, { status: 400 })
  const session = await resolveSession(body.token)
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (body.action === 'logout') {
    await revokeSessionByToken(body.token)
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ userId: session.userId, loginId: session.loginId, displayName: session.displayName, isSystemAdmin: session.isSystemAdmin, siteCode: session.siteCode }, { headers: { 'Cache-Control': 'no-store' } })
}
