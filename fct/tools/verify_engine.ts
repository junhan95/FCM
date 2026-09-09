/**
 * 엔진 검증: 템플릿의 모든 수식 셀을 계산해 엑셀 캐시 값과 비교한다.
 *   npx tsx tools/verify_engine.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Workbook, isErr, setDecimalSeparator } from "../src/engine/workbook";
setDecimalSeparator(","); // 엑셀 캐시값은 독일 로케일(소수점 콤마)로 생성됨
import { Template, PriceRow, CellValue } from "../src/engine/types";

const root = path.join(__dirname, "..", "data");
const template: Template = JSON.parse(fs.readFileSync(path.join(root, "templates.json"), "utf8"));
const prices: PriceRow[] = JSON.parse(fs.readFileSync(path.join(root, "prices.json"), "utf8"));
const expected: Record<string, Record<string, CellValue | string>> = JSON.parse(
  fs.readFileSync(path.join(root, "expected.json"), "utf8"),
);

const wb = new Workbook(template, prices, {});

let total = 0, ok = 0;
const mismatches: string[] = [];
const t0 = Date.now();
for (const [sheet, cells] of Object.entries(expected)) {
  if (template.sheets[sheet]?.hidden) continue;
  for (const [coord, exp] of Object.entries(cells)) {
    total++;
    const got = wb.get(sheet, coord);
    let same = false;
    if (typeof exp === "number") {
      same = typeof got === "number" && (Math.abs(got - exp) <= 1e-6 * Math.max(1, Math.abs(exp)));
    } else if (typeof exp === "string") {
      if (exp.startsWith("#")) same = isErr(got) && (got.code === exp || (exp === "#REF!" && got.code === "#REF!"));
      else same = typeof got === "string" ? got === exp : String(got) === exp;
    } else if (typeof exp === "boolean") same = got === exp;
    else same = got === exp;
    if (same) ok++;
    else if (mismatches.length < 60) mismatches.push(`${sheet}!${coord}: expected=${JSON.stringify(exp)} got=${JSON.stringify(got instanceof Object ? String(got) : got)} f=${template.sheets[sheet].cells[coord].f}`);
  }
}
console.log(`검증: ${ok}/${total} 일치 (${((ok / total) * 100).toFixed(3)}%)  ${Date.now() - t0}ms`);
for (const m of mismatches) console.log("  ✗", m);
if (ok !== total) process.exitCode = 1;
