import { requireSession } from '@/lib/auth/guard'
import UploadForm from './upload-form'
import { parseCsv, parseXlsx } from '@/lib/import/parse'
import { runImport } from '@/lib/import/run'
import type { UploadOutcome } from './upload-form'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * 스프레드시트 업로드 (A-1~A-4).
 * 귀속 사업장은 업로드 세션의 활성 사업장이다.
 */
export default async function ImportPage() {
  const s = await requireSession()

  async function upload(formData: FormData): Promise<UploadOutcome> {
    'use server'
    const sess = await requireSession()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: '파일을 선택하십시오.' }
    if (file.size > MAX_BYTES) return { ok: false, message: '파일이 너무 큽니다 (최대 10MB).' }

    const name = file.name.toLowerCase()
    let parsed
    try {
      if (name.endsWith('.csv') || name.endsWith('.txt')) {
        parsed = parseCsv(await file.text())
      } else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
        parsed = await parseXlsx(await file.arrayBuffer())
      } else {
        return { ok: false, message: 'CSV 또는 XLSX 파일만 지원합니다.' }
      }
    } catch {
      return { ok: false, message: '파일을 읽을 수 없습니다. 형식을 확인하십시오.' }
    }

    if (parsed.rows.length === 0) return { ok: false, message: '데이터 행이 없습니다.' }

    const result = await runImport({
      siteId: sess.siteId, userId: sess.userId, filename: file.name, file: parsed,
    })
    await recordAudit({
      actorUserId: sess.userId, actorSiteId: sess.siteId, targetSiteId: sess.siteId,
      action: 'create', entityType: 'import_batch', entityId: result.batchId,
      detail: { created: result.created, duplicate: result.duplicate, error: result.errorCount },
    })
    return { ok: true, result }
  }

  return (
    <main>
      <h1>스프레드시트 업로드</h1>
      <p className="muted">
        업로드한 고객은 <strong>{s.siteCode}</strong> 사업장으로 귀속됩니다.
        다른 사업장에 넣으려면 해당 사업장으로 다시 로그인해야 합니다.
      </p>

      <UploadForm action={upload} />

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: 15 }}>인식하는 컬럼</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          헤더는 대소문자·공백·기호를 무시하고 매칭합니다. 한국어·독일어·중국어 헤더도 인식합니다.
        </p>
        <table>
          <thead><tr><th>시스템 필드</th><th>인식되는 헤더 예</th></tr></thead>
          <tbody>
            <tr><td>이름</td><td>Name, 이름, 담당자, Ansprechpartner, 姓名</td></tr>
            <tr><td>이메일</td><td>Email, E-Mail, 이메일, 邮箱</td></tr>
            <tr><td>고객사</td><td>Company, Firma, 회사, 고객사, 公司</td></tr>
            <tr><td>분류</td><td>Category, Branche, 분류, 업종</td></tr>
            <tr><td>언어 / 국가</td><td>Language, Country, 언어, 국가, Land</td></tr>
            <tr><td>전화 / 부서 / 직위</td><td>Phone, Department, Position, 전화, 부서, 직위</td></tr>
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          중복은 이메일 기준으로 판정하며 건너뜁니다. 모든 행의 동의 상태는
          <strong> 미확인</strong>으로 들어갑니다 — 근거 없는 데이터를 &ldquo;동의함&rdquo;으로
          이관하면 이 시스템을 도입한 이유가 사라집니다.
        </p>
      </div>
    </main>
  )
}
