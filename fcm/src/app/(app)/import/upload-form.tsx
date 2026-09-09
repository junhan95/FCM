'use client'

import { useState } from 'react'
import type { ImportResult } from '@/lib/import/run'

export type UploadOutcome =
  | { ok: true; result: ImportResult }
  | { ok: false; message: string }

export default function UploadForm({
  action,
}: { action: (fd: FormData) => Promise<UploadOutcome> }) {
  const [state, setState] = useState<UploadOutcome | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <form
        className="card"
        style={{ maxWidth: 560 }}
        onSubmit={async (e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          setBusy(true)
          setState(null)
          try {
            setState(await action(fd))
          } catch {
            setState({ ok: false, message: '업로드 중 오류가 발생했습니다.' })
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="file">CSV 또는 XLSX 파일 (최대 10MB)</label>
        <input id="file" name="file" type="file" accept=".csv,.txt,.xlsx,.xlsm" required />
        <p style={{ marginBottom: 0 }}>
          <button type="submit" disabled={busy}>{busy ? '처리 중…' : '업로드'}</button>
        </p>
      </form>

      {state && !state.ok && (
        <p className="error" style={{ marginTop: '1rem' }}>{state.message}</p>
      )}

      {state?.ok && (
        <div className="card" style={{ marginTop: '1rem', maxWidth: 720 }}>
          <h2 style={{ marginTop: 0, fontSize: 15 }}>업로드 결과</h2>
          <p>
            전체 {state.result.total}행 · <strong>{state.result.created}건 등록</strong> ·
            중복 {state.result.duplicate}건 · 오류 {state.result.errorCount}건
          </p>
          <details>
            <summary>컬럼 매핑</summary>
            <table>
              <thead><tr><th>시스템 필드</th><th>원본 컬럼</th></tr></thead>
              <tbody>
                {Object.entries(state.result.mapping).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v ?? <span className="muted">인식 안 됨</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {state.result.errors.length > 0 && (
            <details>
              <summary>오류 {state.result.errors.length}건</summary>
              <ul>
                {state.result.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e.row}행: {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  )
}
