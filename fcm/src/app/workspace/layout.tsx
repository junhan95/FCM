import { requireSession } from '@/lib/auth/guard'
import { portalLang } from '@/lib/portal-lang'
import PortalHeader from '@/components/PortalHeader'
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <div className="portal"><PortalHeader lang={await portalLang()} signedIn />{children}<footer className="portal-footer"><span>FRANKONIA · CUSTOMER MANAGEMENT</span><span>EMC TEST SOLUTIONS · SINCE 1987</span></footer></div>
}
