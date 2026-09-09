import Papa from 'papaparse'
import ExcelJS from 'exceljs'

/**
 * 업로드 파일 파싱과 컬럼 정규화 (A-1, A-2).
 *
 * 사업장마다 스프레드시트 양식이 다르고 언어도 다르다. 원본 헤더를
 * 시스템 필드로 매핑하되, 매핑 결과를 import_batch 에 기록해
 * 나중에 "무엇이 무엇으로 들어갔는지" 확인할 수 있게 한다.
 */

export type Field =
  | 'name' | 'email' | 'company' | 'category' | 'language' | 'country'
  | 'phone' | 'department' | 'position'

/** 헤더 후보. 소문자·공백/기호 제거 후 비교한다. */
const HEADER_ALIASES: Record<Field, string[]> = {
  name:       ['name', 'fullname', 'contactname', 'contact', '이름', '성명', '담당자', '담당자명', 'ansprechpartner', '姓名', '联系人'],
  email:      ['email', 'mail', 'emailaddress', 'e', '이메일', '메일', '전자우편', 'epost', '邮箱', '电子邮件'],
  company:    ['company', 'companyname', 'customer', 'account', 'organisation', 'organization', 'firma', 'kunde', '회사', '회사명', '고객사', '업체', '公司'],
  category:   ['category', 'segment', 'industry', 'type', 'branche', '분류', '카테고리', '업종', '类别'],
  language:   ['language', 'lang', 'sprache', '언어', '语言'],
  country:    ['country', 'land', 'nation', '국가', '나라', '国家'],
  phone:      ['phone', 'tel', 'telephone', 'mobile', 'telefon', '전화', '전화번호', '연락처', '휴대폰', '电话'],
  department: ['department', 'dept', 'division', 'abteilung', '부서', '팀', '部门'],
  position:   ['position', 'title', 'jobtitle', 'role', '직위', '직급', '직책', '职位'],
}

function canon(s: string): string {
  return s.toLowerCase().replace(/[\s._\-()/]/g, '')
}

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

export function mapColumns(headers: string[]): Record<Field, string | null> {
  const result = {} as Record<Field, string | null>
  const used = new Set<string>()
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const aliases = HEADER_ALIASES[field]
    const hit = headers.find((h) => !used.has(h) && aliases.includes(canon(h)))
    result[field] = hit ?? null
    if (hit) used.add(hit)
  }
  return result
}

export function parseCsv(text: string): ParsedFile {
  const out = Papa.parse<Record<string, string>>(text, {
    header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim(),
  })
  return { headers: out.meta.fields ?? [], rows: out.data ?? [] }
}

export async function parseXlsx(buf: ArrayBuffer): Promise<ParsedFile> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (!ws) return { headers: [], rows: [] }

  const headers: string[] = []
  ws.getRow(1).eachCell((cell, col) => { headers[col - 1] = String(cell.value ?? '').trim() })

  const rows: Record<string, string>[] = []
  ws.eachRow((row, idx) => {
    if (idx === 1) return
    const obj: Record<string, string> = {}
    let empty = true
    headers.forEach((h, i) => {
      if (!h) return
      const raw = row.getCell(i + 1).value
      const v = cellToString(raw)
      obj[h] = v
      if (v) empty = false
    })
    if (!empty) rows.push(obj)
  })
  return { headers: headers.filter(Boolean), rows }
}

function cellToString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; hyperlink?: string }
    if (typeof o.text === 'string') return o.text.trim()
    if (o.result != null) return String(o.result).trim()
    if (typeof o.hyperlink === 'string') return o.hyperlink.replace(/^mailto:/i, '').trim()
    if (v instanceof Date) return v.toISOString()
  }
  return String(v).trim()
}
