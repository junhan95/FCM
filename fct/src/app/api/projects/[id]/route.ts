import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getProject, isProjectEditor, updateProjectOverrides, audit } from "@/lib/data";
import { projectAccess } from "@/lib/access";
import { Overrides } from "@/engine/types";
import { HIDDEN_SHEET, PLACEMENT_SHEET } from "@/lib/placement";
import { ITEMS_SHEET, ITEM_COORD_RE } from "@/lib/custom-items";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const p = await getProject(Number(id));
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(p);
}

/** 프로젝트 입력값(overrides) 저장 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const pid = Number(id);
  const p = await getProject(pid);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  // 열람 전용 계정의 저장 요청은 여기서 막는다 (화면 차단과 별개로 서버에서도 확인)
  const access = projectAccess(s, p, await isProjectEditor(pid, s.id));
  if (!access.canEdit) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json()) as { overrides?: Overrides };
  if (!body.overrides || typeof body.overrides !== "object") return Response.json({ error: "bad request" }, { status: 400 });
  // 값 검증: sheet → coord → number|string 만 허용.
  // 예약 시트(`__placement`·`__hidden`)는 "<시트>!<행>" → 숫자 라서 규칙이 다르다.
  const clean: Overrides = {};
  for (const [sheet, cells] of Object.entries(body.overrides)) {
    if (typeof cells !== "object" || !cells) continue;
    const isPlacement = sheet === PLACEMENT_SHEET || sheet === HIDDEN_SHEET;
    const isItems = sheet === ITEMS_SHEET;
    const out: Record<string, number | string> = {};
    for (const [coord, v] of Object.entries(cells)) {
      if (isPlacement) {
        if (!/^[^!]{1,64}!\d{1,7}$/.test(coord)) continue;
        if (typeof v === "number" && Number.isFinite(v)) out[coord] = v;
        continue;
      }
      if (isItems) {
        // 자유 입력 품목 — "<Total 행>!<번호>!<필드>" / "<Total 행>!meta!<키>"
        if (!ITEM_COORD_RE.test(coord)) continue;
        if (typeof v === "number" && Number.isFinite(v)) out[coord] = v;
        else if (typeof v === "string" && v.length <= 2000) out[coord] = v;
        continue;
      }
      if (!/^[A-Z]{1,3}\d{1,7}$/.test(coord)) continue;
      if (typeof v === "number" && Number.isFinite(v)) out[coord] = v;
      else if (typeof v === "string" && v.length <= 2000) out[coord] = v;
    }
    if (Object.keys(out).length) clean[sheet] = out;
  }
  await updateProjectOverrides(pid, clean);
  await audit(s.id, "SAVE_PROJECT", String(pid), { cells: Object.values(clean).reduce((n, c) => n + Object.keys(c).length, 0) });
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
