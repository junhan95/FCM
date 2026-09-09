import { sql } from 'drizzle-orm'
import { getAppDb } from '@/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await getAppDb().execute(sql`select 1`)
    return Response.json({ status: 'ok', app: 'fcm', fcmIntegration: !!process.env.FCM_BRIDGE_SECRET })
  } catch {
    return Response.json({ status: 'db_unavailable' }, { status: 503 })
  }
}
