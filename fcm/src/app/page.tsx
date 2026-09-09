import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

export default async function Root() {
  const s = await getSession()
  redirect(s ? '/workspace' : '/login')
}
