/**
 * DB 초기화 스크립트
 *   npm run db:setup
 *
 * 1) db/schema.sql 적용
 * 2) data/prices.json → price_items (비어 있을 때만)
 * 3) data/templates.json → templates (같은 version 이 없을 때만)
 * 4) 관리자 계정 생성 (ADMIN_USERNAME / ADMIN_PASSWORD 환경변수, 기본 admin / admin1234)
 */
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// .env 로드 (dotenv 없이 간단 파서)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TEMPLATE_VERSION = process.env.TEMPLATE_VERSION ?? "rev-x3.10";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 .env 에 없습니다");
  // 대상 데이터베이스가 없으면 생성 (postgres 기본 DB로 접속)
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "") || "fct";
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
      console.log(`0) 데이터베이스 '${dbName}' 생성`);
    }
  } catch (e) {
    console.log("0) 데이터베이스 존재 확인 건너뜀:", (e as Error).message);
  } finally {
    await admin.end();
  }
  const pool = new Pool({ connectionString: url });
  const c = await pool.connect();
  try {
    console.log("1) 스키마 적용");
    await c.query(fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));

    console.log("2) 가격 DB 시드");
    const { rows: pc } = await c.query("SELECT count(*)::int AS n FROM price_items");
    if (pc[0].n === 0) {
      const prices = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "prices.json"), "utf8")) as Record<string, unknown>[];
      await c.query("BEGIN");
      for (const p of prices) {
        await c.query(
          `INSERT INTO price_items (row, ref, sage, item, description, unit, price, delivery, col_h, col_i, col_j, col_k, price_date, category, is_header)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            p.row,
            p.ref === null || p.ref === undefined ? null : JSON.stringify(p.ref),
            p.sage == null ? null : String(p.sage),
            p.item == null ? null : String(p.item),
            p.description == null ? null : String(p.description),
            p.unit == null ? null : String(p.unit),
            typeof p.price === "number" ? p.price : null,
            p.delivery == null ? null : JSON.stringify(p.delivery),
            p.colH == null ? null : JSON.stringify(p.colH),
            p.colI == null ? null : JSON.stringify(p.colI),
            p.colJ == null ? null : JSON.stringify(p.colJ),
            p.colK == null ? null : JSON.stringify(p.colK),
            p.priceDate == null ? null : String(p.priceDate),
            p.category ?? null,
            !!p.isHeader,
          ],
        );
      }
      await c.query("COMMIT");
      console.log(`   ${prices.length}행 입력`);
    } else console.log(`   이미 ${pc[0].n}행 존재 — 건너뜀`);

    console.log("3) 템플릿 시드");
    const { rows: tc } = await c.query("SELECT id FROM templates WHERE version = $1", [TEMPLATE_VERSION]);
    if (tc.length === 0) {
      const tpl = fs.readFileSync(path.join(process.cwd(), "data", "templates.json"), "utf8");
      await c.query("UPDATE templates SET is_default = FALSE");
      await c.query("INSERT INTO templates (name, version, json, is_default) VALUES ($1, $2, $3::jsonb, TRUE)", [
        "Global calculation table template",
        TEMPLATE_VERSION,
        tpl,
      ]);
      console.log(`   템플릿 ${TEMPLATE_VERSION} 입력`);
    } else console.log(`   템플릿 ${TEMPLATE_VERSION} 이미 존재 — 건너뜀`);

    console.log("4) 관리자 계정");
    const username = process.env.ADMIN_USERNAME ?? "admin";
    const password = process.env.ADMIN_PASSWORD ?? "admin1234";
    const { rows: uc } = await c.query("SELECT id FROM users WHERE username = $1", [username]);
    if (uc.length === 0) {
      await c.query("INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, 'ADMIN')", [
        username,
        await bcrypt.hash(password, 10),
        "Administrator",
      ]);
      console.log(`   관리자 '${username}' 생성 (초기 비밀번호: ${password}) — 로그인 후 반드시 변경하세요`);
    } else console.log(`   관리자 '${username}' 이미 존재`);
    console.log("완료");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
