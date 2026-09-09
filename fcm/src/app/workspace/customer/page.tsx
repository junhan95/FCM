import Link from 'next/link'
import { requireSession } from '@/lib/auth/guard'
import { portalLang } from '@/lib/portal-lang'
export default async function Customer() {
  await requireSession(); const ko = await portalLang() === 'ko'
  return <main className="workspace-main"><Link className="back-link" href="/workspace">← {ko ? '메뉴 선택' : 'Choose a workspace'}</Link><div className="workspace-intro"><p className="portal-eyebrow">CUSTOMER COMMUNICATION</p><h1>Frankonia Customer Management</h1><p>{ko ? 'Frankonia 등록 고객에게 소식과 정보를 전달하는 공간입니다.' : 'Connect registered Frankonia customers with the latest news and information.'}</p></div><div className="customer-grid"><Link className="settings-form" href="/contacts"><h2>{ko ? '등록 고객' : 'Registered customers'}</h2><p>{ko ? '고객 연락처를 조회하고 관리합니다.' : 'View and manage customer contacts.'}</p><span className="module-cta">{ko ? '고객 관리 열기' : 'Open customer directory'} →</span></Link><div className="settings-form"><span className="site-tag">{ko ? '준비 중' : 'Not configured'}</span><h2>{ko ? '메일 · 뉴스' : 'Email & news'}</h2><p>{ko ? '메일 발송 및 뉴스 배포는 발송 서비스 연결 후 제공됩니다. 현재 고객 관리와 업로드를 사용할 수 있습니다.' : 'Email delivery and news distribution will be available after a sending service is configured. Customer management and imports are available now.'}</p></div></div></main>
}
