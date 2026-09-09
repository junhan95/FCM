import { getPool, query, queryOne } from "./db";
import { Overrides, PriceRow, Scalar, Template } from "@/engine/types";

// ---------- 템플릿 ----------
export interface TemplateRecord {
  id: number;
  name: string;
  version: string;
  json: Template;
  is_default: boolean;
}

const templateCache = new Map<number, TemplateRecord>();

export async function getDefaultTemplate(): Promise<TemplateRecord> {
  const row = await queryOne<{ id: number }>("SELECT id FROM templates WHERE is_default ORDER BY id DESC LIMIT 1");
  if (!row) throw new Error("기본 템플릿이 없습니다. npm run db:setup 을 실행하세요.");
  return getTemplate(row.id);
}

export async function getTemplate(id: number): Promise<TemplateRecord> {
  const hit = templateCache.get(id);
  if (hit) return hit;
  const row = await queryOne<TemplateRecord>("SELECT id, name, version, json, is_default FROM templates WHERE id = $1", [id]);
  if (!row) throw new Error("템플릿을 찾을 수 없습니다: " + id);
  templateCache.set(id, row);
  return row;
}

export async function listTemplates() {
  return query<{ id: number; name: string; version: string; is_default: boolean; created_at: string }>(
    "SELECT id, name, version, is_default, created_at FROM templates ORDER BY id DESC",
  );
}

// ---------- 가격 DB ----------
interface PriceDbRow {
  id: number;
  row: number;
  ref: Scalar;
  sage: string | null;
  item: string | null;
  description: string | null;
  unit: string | null;
  price: number | null;
  delivery: Scalar;
  col_h: Scalar;
  col_i: Scalar;
  col_j: Scalar;
  col_k: Scalar;
  price_date: string | null;
  category: string | null;
  is_header: boolean;
  updated_at: string;
}

export interface PriceItem extends PriceRow {
  id: number;
  updatedAt: string;
}

function toPriceRow(r: PriceDbRow): PriceItem {
  return {
    id: r.id,
    row: r.row,
    ref: (r.ref as number | string | null) ?? null,
    sage: r.sage,
    item: r.item,
    description: r.description,
    unit: r.unit,
    price: r.price,
    delivery: r.delivery,
    colH: r.col_h,
    colI: r.col_i,
    colJ: r.col_j,
    colK: r.col_k,
    priceDate: r.price_date,
    category: r.category,
    isHeader: r.is_header,
    updatedAt: r.updated_at,
  };
}

export async function getPrices(): Promise<PriceItem[]> {
  const rows = await query<PriceDbRow>("SELECT * FROM price_items ORDER BY row");
  return rows.map(toPriceRow);
}

export async function getPricesVersion(): Promise<string> {
  const r = await queryOne<{ v: string | null; n: number }>("SELECT max(updated_at)::text AS v, count(*)::int AS n FROM price_items");
  return `${r?.n ?? 0}-${r?.v ?? ""}`;
}

export async function updatePriceItem(
  id: number,
  fields: { item?: string | null; description?: string | null; unit?: string | null; price?: number | null; delivery?: string | null; priceDate?: string | null },
  userId: number,
) {
  const cur = await queryOne<PriceDbRow>("SELECT * FROM price_items WHERE id = $1", [id]);
  if (!cur) throw new Error("가격 항목이 없습니다");
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, v: unknown) => {
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  };
  if (fields.item !== undefined) push("item", fields.item);
  if (fields.description !== undefined) push("description", fields.description);
  if (fields.unit !== undefined) push("unit", fields.unit);
  if (fields.price !== undefined) push("price", fields.price);
  if (fields.delivery !== undefined) push("delivery", fields.delivery === null ? null : JSON.stringify(fields.delivery));
  if (fields.priceDate !== undefined) push("price_date", fields.priceDate);
  if (!sets.length) return;
  push("updated_by", userId);
  params.push(id);
  await query(`UPDATE price_items SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
  if (fields.price !== undefined && fields.price !== cur.price) {
    await query("INSERT INTO price_history (price_item_id, old_price, new_price, changed_by) VALUES ($1,$2,$3,$4)", [
      id,
      cur.price,
      fields.price,
      userId,
    ]);
  }
}

export async function createPriceItem(
  fields: { ref: string; item: string; description?: string; unit?: string; price: number; category?: string },
  userId: number,
) {
  const refVal: number | string = /^\d+(\.\d+)?$/.test(fields.ref.trim()) ? Number(fields.ref) : fields.ref.trim();
  const next = await queryOne<{ r: number }>("SELECT coalesce(max(row), 0) + 1 AS r FROM price_items");
  await query(
    `INSERT INTO price_items (row, ref, item, description, unit, price, category, price_date, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, to_char(now(), 'YYYY-MM-DD'), $8)`,
    [next!.r, JSON.stringify(refVal), fields.item, fields.description ?? null, fields.unit ?? null, fields.price, fields.category ?? null, userId],
  );
}

export async function getPriceHistory(priceItemId: number) {
  return query<{ old_price: number | null; new_price: number | null; changed_at: string; username: string | null }>(
    `SELECT h.old_price, h.new_price, h.changed_at, u.username FROM price_history h LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.price_item_id = $1 ORDER BY h.changed_at DESC LIMIT 50`,
    [priceItemId],
  );
}

// ---------- 프로젝트 ----------
export interface ProjectRecord {
  id: number;
  name: string;
  customer: string;
  country: string;
  quotation_no: string;
  revision: string;
  editor: string;
  status: string;
  template_id: number;
  overrides: Overrides;
  notes: string;
  created_by: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

/** 검색 가능한 열 — 사용자가 고른 값은 이 표를 거쳐야만 SQL 에 들어간다 */
export const PROJECT_SEARCH_FIELDS = {
  name: "coalesce(p.name,'')",
  customer: "coalesce(p.customer,'')",
  country: "coalesce(p.country,'')",
  quotation: "concat_ws(' ', p.quotation_no, p.revision)",
  status: "coalesce(p.status,'')",
  editor: "coalesce(p.editor,'')",
} as const;
export type ProjectSearchField = keyof typeof PROJECT_SEARCH_FIELDS;

const ALL_FIELDS = "concat_ws(' ', p.name, p.customer, p.country, p.quotation_no, p.revision, p.status, p.editor)";

export async function listProjects(q?: string, field?: string): Promise<ProjectRecord[]> {
  const base = `SELECT p.*, u.username AS created_by_name FROM projects p LEFT JOIN users u ON u.id = p.created_by`;
  const term = (q ?? "").trim();
  if (!term) return query<ProjectRecord>(`${base} ORDER BY p.updated_at DESC`);
  const target = field && field in PROJECT_SEARCH_FIELDS ? PROJECT_SEARCH_FIELDS[field as ProjectSearchField] : ALL_FIELDS;
  return query<ProjectRecord>(`${base} WHERE ${target} ILIKE $1 ORDER BY p.updated_at DESC`, [`%${term}%`]);
}

/** 검색과 무관한 전체 개수 (검색 결과를 "n / 전체" 로 보여 줄 때 쓴다) */
export async function countProjects(): Promise<number> {
  const r = await queryOne<{ n: number }>("SELECT count(*)::int AS n FROM projects");
  return r?.n ?? 0;
}

export async function getProject(id: number): Promise<ProjectRecord | null> {
  return queryOne<ProjectRecord>(
    `SELECT p.*, u.username AS created_by_name FROM projects p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = $1`,
    [id],
  );
}

export async function createProject(
  f: { name: string; customer?: string; country?: string; quotationNo?: string; revision?: string; editor?: string; templateId: number; overrides?: Overrides },
  userId: number,
): Promise<number> {
  const r = await queryOne<{ id: number }>(
    `INSERT INTO projects (name, customer, country, quotation_no, revision, editor, template_id, overrides, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING id`,
    [f.name, f.customer ?? "", f.country ?? "", f.quotationNo ?? "", f.revision ?? "", f.editor ?? "", f.templateId, JSON.stringify(f.overrides ?? {}), userId],
  );
  return r!.id;
}

// ---------- 프로젝트 공동 작업자 ----------
export interface ProjectMember {
  user_id: number;
  username: string;
  name: string;
  role: string;
  can_edit: boolean;
  added_at: string;
}

export async function listProjectMembers(projectId: number): Promise<ProjectMember[]> {
  return query<ProjectMember>(
    `SELECT m.user_id, u.username, u.name, u.role, m.can_edit, m.added_at
       FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = $1
      ORDER BY u.username`,
    [projectId],
  );
}

/** 이 사용자가 프로젝트의 편집 권한을 가진 공동 작업자인지 */
export async function isProjectEditor(projectId: number, userId: number): Promise<boolean> {
  const r = await queryOne<{ can_edit: boolean }>(
    "SELECT can_edit FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, userId],
  );
  return !!r?.can_edit;
}

export async function addProjectMember(projectId: number, userId: number, addedBy: number) {
  await query(
    `INSERT INTO project_members (project_id, user_id, added_by) VALUES ($1,$2,$3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET can_edit = TRUE`,
    [projectId, userId, addedBy],
  );
}

export async function removeProjectMember(projectId: number, userId: number) {
  await query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, userId]);
}

/** 공동 작업자로 고를 수 있는 활성 계정 */
export async function listAssignableUsers(): Promise<{ id: number; username: string; name: string; role: string }[]> {
  return query("SELECT id, username, name, role FROM users WHERE active ORDER BY username");
}

export async function updateProjectOverrides(id: number, overrides: Overrides) {
  await query("UPDATE projects SET overrides = $1::jsonb, updated_at = now() WHERE id = $2", [JSON.stringify(overrides), id]);
}

export async function updateProjectMeta(
  id: number,
  f: { name?: string; customer?: string; country?: string; quotationNo?: string; revision?: string; editor?: string; status?: string; notes?: string },
) {
  const map: Record<string, string> = { name: "name", customer: "customer", country: "country", quotationNo: "quotation_no", revision: "revision", editor: "editor", status: "status", notes: "notes" };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    const v = (f as Record<string, string | undefined>)[k];
    if (v !== undefined) {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return;
  params.push(id);
  await query(`UPDATE projects SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
}

export async function deleteProject(id: number) {
  await query("DELETE FROM projects WHERE id = $1", [id]);
}

export async function saveSnapshot(projectId: number, label: string, overrides: Overrides, summary: unknown, userId: number) {
  await query("INSERT INTO project_snapshots (project_id, label, overrides, summary, created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)", [
    projectId,
    label,
    JSON.stringify(overrides),
    JSON.stringify(summary ?? null),
    userId,
  ]);
}

export async function listSnapshots(projectId: number) {
  return query<{ id: number; label: string; summary: unknown; created_at: string; username: string | null }>(
    `SELECT s.id, s.label, s.summary, s.created_at, u.username FROM project_snapshots s LEFT JOIN users u ON u.id = s.created_by
     WHERE s.project_id = $1 ORDER BY s.id DESC`,
    [projectId],
  );
}

export async function getSnapshot(id: number) {
  return queryOne<{ id: number; project_id: number; overrides: Overrides }>("SELECT id, project_id, overrides FROM project_snapshots WHERE id = $1", [id]);
}

// ---------- 사용자 ----------
export interface UserRecord {
  id: number;
  username: string;
  name: string;
  role: "ADMIN" | "USER";
  active: boolean;
  created_at: string;
}

export async function listUsers(): Promise<UserRecord[]> {
  return query<UserRecord>("SELECT id, username, name, role, active, created_at FROM users ORDER BY id");
}

export async function audit(userId: number | null, action: string, target = "", detail?: unknown) {
  await query("INSERT INTO audit_log (user_id, action, target, detail) VALUES ($1,$2,$3,$4::jsonb)", [
    userId,
    action,
    target,
    detail === undefined ? null : JSON.stringify(detail),
  ]);
}

// ---------- 가격 DB 엑셀 업로드 ----------

export interface PriceImportRecord {
  id: number;
  version: string | null;
  file_name: string | null;
  rows: number;
  added: number;
  changed: number;
  removed: number;
  uploaded_at: string;
  username: string | null;
}

export interface PriceChangeRecord {
  row: number;
  ref: string | null;
  item: string | null;
  kind: "added" | "price" | "text" | "removed";
  old_price: number | null;
  new_price: number | null;
}

export async function latestPriceImport(): Promise<PriceImportRecord | null> {
  return queryOne<PriceImportRecord>(
    `SELECT i.*, u.username FROM price_imports i LEFT JOIN users u ON u.id = i.uploaded_by ORDER BY i.uploaded_at DESC LIMIT 1`,
  );
}

export async function listPriceImports(limit = 10): Promise<PriceImportRecord[]> {
  return query<PriceImportRecord>(
    `SELECT i.*, u.username FROM price_imports i LEFT JOIN users u ON u.id = i.uploaded_by ORDER BY i.uploaded_at DESC LIMIT $1`,
    [limit],
  );
}

export async function getPriceImportChanges(importId: number, limit = 2000): Promise<PriceChangeRecord[]> {
  return query<PriceChangeRecord>(
    `SELECT row, ref, item, kind, old_price, new_price FROM price_import_changes
     WHERE import_id = $1 ORDER BY (kind = 'added') DESC, row LIMIT $2`,
    [importId, limit],
  );
}

/** 가격 DB 를 파일 내용으로 통째로 맞춘다 — 한 트랜잭션에서 처리한다 */
export async function applyPriceImport(
  rows: PriceRow[],
  meta: { version: string | null; fileName: string },
  userId: number,
): Promise<{ importId: number; added: number; changed: number; removed: number }> {
  const pool = getPool();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows: curRows } = await c.query<PriceDbRow>("SELECT * FROM price_items");
    const cur = new Map<number, PriceDbRow>();
    for (const r of curRows) cur.set(r.row, r);

    const changes: PriceChangeRecord[] = [];
    const seen = new Set<number>();
    const eq = (a: unknown, b: unknown) => {
      if (a === b) return true;
      if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-6;
      return String(a ?? "").trim() === String(b ?? "").trim();
    };

    for (const r of rows) {
      seen.add(r.row);
      const old = cur.get(r.row);
      const j = (v: unknown) => (v === undefined ? null : JSON.stringify(v ?? null));
      await c.query(
        `INSERT INTO price_items (row, ref, sage, item, description, unit, price, delivery, col_h, col_i, col_j, col_k, price_date, category, is_header, updated_at, updated_by)
         VALUES ($1,$2::jsonb,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15, now(), $16)
         ON CONFLICT (row) DO UPDATE SET
           ref = EXCLUDED.ref, sage = EXCLUDED.sage, item = EXCLUDED.item, description = EXCLUDED.description,
           unit = EXCLUDED.unit, price = EXCLUDED.price, delivery = EXCLUDED.delivery,
           col_h = EXCLUDED.col_h, col_i = EXCLUDED.col_i, col_j = EXCLUDED.col_j, col_k = EXCLUDED.col_k,
           price_date = EXCLUDED.price_date, category = EXCLUDED.category, is_header = EXCLUDED.is_header,
           updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [
          r.row, j(r.ref), r.sage, r.item, r.description, r.unit, r.price,
          j(r.delivery), j(r.colH), j(r.colI), j(r.colJ), j(r.colK),
          r.priceDate, r.category, !!r.isHeader, userId,
        ],
      );
      if (r.isHeader && r.ref === null) continue; // 머리글 줄은 변경 목록에 넣지 않는다
      const refText = r.ref === null || r.ref === undefined ? null : String(r.ref);
      const itemText = r.item === null || r.item === undefined ? null : String(r.item);
      const oldPrice = typeof old?.price === "number" ? old.price : null;
      const newPrice = typeof r.price === "number" ? r.price : null;
      if (!old) {
        changes.push({ row: r.row, ref: refText, item: itemText, kind: "added", old_price: null, new_price: newPrice });
      } else if (!eq(old.price, r.price)) {
        changes.push({ row: r.row, ref: refText, item: itemText, kind: "price", old_price: oldPrice, new_price: newPrice });
      } else if (!eq(old.item, r.item) || !eq(old.description, r.description) || !eq(old.unit, r.unit)) {
        changes.push({ row: r.row, ref: refText, item: itemText, kind: "text", old_price: oldPrice, new_price: oldPrice });
      }
    }

    const gone = curRows.filter((r) => !seen.has(r.row));
    for (const g of gone) {
      changes.push({
        row: g.row,
        ref: g.ref === null || g.ref === undefined ? null : String(g.ref),
        item: g.item === null || g.item === undefined ? null : String(g.item),
        kind: "removed",
        old_price: g.price,
        new_price: null,
      });
    }
    if (gone.length) await c.query("DELETE FROM price_items WHERE row = ANY($1::int[])", [gone.map((g) => g.row)]);

    const added = changes.filter((x) => x.kind === "added").length;
    const changed = changes.filter((x) => x.kind === "price" || x.kind === "text").length;
    const removed = gone.length;

    const ins = await c.query<{ id: number }>(
      `INSERT INTO price_imports (version, file_name, rows, added, changed, removed, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [meta.version, meta.fileName, rows.length, added, changed, removed, userId],
    );
    const importId = ins.rows[0].id;
    for (const ch of changes) {
      await c.query(
        `INSERT INTO price_import_changes (import_id, row, ref, item, kind, old_price, new_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [importId, ch.row, ch.ref, ch.item, ch.kind, ch.old_price, ch.new_price],
      );
    }
    await c.query("COMMIT");
    return { importId, added, changed, removed };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
