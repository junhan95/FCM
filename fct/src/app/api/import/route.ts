import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getDefaultTemplate, getPrices } from "@/lib/data";
import { parseQuotationWorkbook } from "@/lib/import-excel";
import { getLang } from "@/lib/lang";
import { importMsg } from "@/lib/import-msg";
import { Workbook } from "@/engine/workbook";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

/** 엑셀 견적서를 읽어 미리보기 + 입력값(overrides) 을 돌려준다 (저장은 하지 않음) */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });

  const lang = await getLang();
  const M = importMsg(lang);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: M.noFile }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: M.tooBig(MAX_BYTES / 1024 / 1024) }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ error: M.notXlsx }, { status: 400 });

  const tpl = await getDefaultTemplate();
  try {
    const prices = await getPrices();
    const knownRefs = new Set<string>();
    for (const p of prices) if (p.ref !== null && p.ref !== undefined && String(p.ref) !== "") knownRefs.add(String(p.ref).trim().toLowerCase());
    const preview = await parseQuotationWorkbook(await file.arrayBuffer(), tpl.json, tpl.version, lang, knownRefs);
    // 현재 가격 DB 로 다시 계산해 엑셀 값과 비교할 수 있게 한다
    let recalculated: number | null = null;
    try {
      const wb = new Workbook(tpl.json, prices, preview.overrides);
      const v = wb.get("Total", "AE66");
      recalculated = typeof v === "number" ? v : null;
    } catch {
      recalculated = null;
    }
    return Response.json({ ...preview, recalculated, fileName: file.name, templateId: tpl.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message || M.readFailed }, { status: 400 });
  }
}
