import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPrices, getPricesVersion, getTemplate, getDefaultTemplate } from "@/lib/data";

/**
 * 계산 엔진 데이터 (템플릿 + 가격 DB). 클라이언트가 한 번 받아 메모리에 캐시한다.
 * ETag = 템플릿 id + 가격 DB 버전 → 가격이 바뀌면 자동 갱신
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tid = req.nextUrl.searchParams.get("template");
  const tpl = tid ? await getTemplate(Number(tid)) : await getDefaultTemplate();
  const pv = await getPricesVersion();
  const etag = `"t${tpl.id}-${pv}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  const prices = await getPrices();
  return Response.json(
    { templateId: tpl.id, version: tpl.version, template: tpl.json, prices },
    { headers: { ETag: etag, "Cache-Control": "private, no-cache" } },
  );
}
