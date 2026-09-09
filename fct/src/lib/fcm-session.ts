import { randomBytes } from 'node:crypto';
import { queryOne } from './db';
import type { SessionUser } from './auth';

export function fcmOrigin() {
  const url = new URL(process.env.FCM_ORIGIN ?? 'http://127.0.0.1:3002');
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('FCM_ORIGIN must be a loopback origin');
  return url.origin;
}
async function bridge(token: string, action?: string) {
  const secret = process.env.FCM_BRIDGE_SECRET;
  if (!secret || secret.length < 32) return null;
  try {
    const res = await fetch(`${fcmOrigin()}/api/integration/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ token, action }), cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
export async function resolveFcmSession(token: string): Promise<SessionUser | null> {
  const identity = await bridge(token);
  if (!identity || typeof identity.userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(identity.userId) || typeof identity.loginId !== 'string' || typeof identity.displayName !== 'string' || typeof identity.isSystemAdmin !== 'boolean') return null;
  // Separate namespace prevents an FCM account from claiming an existing FCT
  // account with the same name. Existing quotation ownership is preserved.
  const username = `fcm:${identity.userId}`;
  const role = identity.isSystemAdmin ? 'ADMIN' : 'USER';
  const local = await queryOne<{id: number; active: boolean}>(
    `INSERT INTO users (username, password_hash, name, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
     RETURNING id, active`, [username, `!fcm-only:${randomBytes(32).toString('hex')}`, identity.displayName, role]);
  if (!local?.active) return null;
  return { id: local.id, username: identity.loginId, name: identity.displayName, role, authProvider: 'fcm' };
}
export async function revokeFcmSession(token: string) { await bridge(token, 'logout'); }
