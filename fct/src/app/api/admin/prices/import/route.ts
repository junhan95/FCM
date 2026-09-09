import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { applyPriceImport, audit, getPrices } from "@/lib/data";
import { readPriceWorkbook } from "@/lib/price-import";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

const ERR: Record<string, string> = {
  EXCEL_OPEN_FAILED: "엑셀 파일을 열 수 없습니다. 손상되었거나 .xlsx 형식이 아닙니다.",
  NO_PRICES_SHEET: "'Prices resume' 시트가 없습니다. Frankonia 계산표 파일이 맞는지 확인하세요.",
  EMPTY_PRICES_SHEET: "'Prices resume' 시트에서 읽을 내용이 없습니다.",
};

/**
 * 가격 DB 엑셀 업로드.
 *   apply 없음 → 미리보기만 (저장하지 않음)
 *   apply=1    → 실제로 반영
 */
export async function POST(req: NextRequest) {
  const s = await requireAdmin();

  const form = await req.formData();
  const file = form.get("file");
  const apply = String(form.get("apply") ?? "") === "1";
  if (!(file instanceof File)) return Response.json({ error: "파일이 없습니다." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `파일이 너무 큽니다 (최대 ${MAX_BYTES / 1024 / 1024}MB).` }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ error: ".xlsx 파일만 올릴 수 있습니다." }, { status: 400 });

  try {
    const current = await getPrices();
    const res = await readPriceWorkbook(await file.arrayBuffer(), file.name, current);
    if (!apply) {
      // 미리보기 — 행 내용은 돌려주지 않는다 (용량이 크고, 적용은 파일을 다시 읽는다)
      const { rows, ...preview } = res;
      return Response.json({ ...preview, total: rows.length, currentTotal: current.length });
    }
    const out = await applyPriceImport(res.rows, { version: res.version, fileName: res.fileName }, s.id);
    await audit(s.id, "IMPORT_PRICES", String(out.importId), {
      file: res.fileName,
      version: res.version,
      added: out.added,
      changed: out.changed,
      removed: out.removed,
    });
    return Response.json({ ok: true, ...out, version: res.version, total: res.rows.length });
  } catch (e) {
    const key = e instanceof Error ? e.message : "";
    return Response.json({ error: ERR[key] ?? `읽는 중 오류가 났습니다: ${key}` }, { status: 400 });
  }
}
