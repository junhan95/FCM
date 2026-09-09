/**
 * 엑셀 수식 파서 (템플릿에서 사용되는 부분집합)
 *
 * 지원: 숫자, 문자열, TRUE/FALSE, 셀 참조(A1, $A$1, Sheet!A1, 'Sheet name'!A1),
 *       범위(A1:B2, 1:1048576, E:E), 이름 정의, 함수 호출,
 *       연산자 + - * / ^ & = <> < > <= >=, 단항 -, 괄호, %, #REF! 등 오류 리터럴
 */

export type Ast =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "err"; v: string }
  | { t: "empty" }
  | { t: "ref"; sheet?: string; col: number; row: number }
  | { t: "range"; sheet?: string; c1: number; r1: number; c2: number; r2: number }
  | { t: "name"; v: string }
  | { t: "call"; fn: string; args: Ast[] }
  | { t: "un"; op: string; a: Ast }
  | { t: "bin"; op: string; a: Ast; b: Ast };

interface Tok {
  k: "num" | "str" | "id" | "op" | "err" | "eof";
  v: string;
}

const MAX_ROW = 1048576;
const MAX_COL = 16384;

export function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export function parseCoord(coord: string): { col: number; row: number } {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(coord);
  if (!m) throw new Error("bad coord " + coord);
  return { col: colToNum(m[1]), row: parseInt(m[2], 10) };
}
export function coordOf(col: number, row: number) {
  return numToCol(col) + row;
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let s = "";
      while (j < n) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            s += '"';
            j += 2;
            continue;
          }
          break;
        }
        s += src[j++];
      }
      toks.push({ k: "str", v: s });
      i = j + 1;
      continue;
    }
    if (ch === "'") {
      // 'Sheet name'!A1  → 시트명 토큰으로 처리
      let j = i + 1;
      let s = "";
      while (j < n) {
        if (src[j] === "'") {
          if (src[j + 1] === "'") {
            s += "'";
            j += 2;
            continue;
          }
          break;
        }
        s += src[j++];
      }
      i = j + 1;
      // 이어지는 ! 까지 포함해 식별자로
      toks.push({ k: "id", v: "'" + s + "'" });
      continue;
    }
    if (ch === "#") {
      const m = /^#[A-Z0-9\/]+[!?]?/.exec(src.slice(i));
      if (m) {
        toks.push({ k: "err", v: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if ((ch >= "0" && ch <= "9") || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      toks.push({ k: "num", v: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$.]*/.exec(src.slice(i))!;
      toks.push({ k: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      toks.push({ k: "op", v: two });
      i += 2;
      continue;
    }
    if ("+-*/^&=<>(),:;%!".includes(ch)) {
      toks.push({ k: "op", v: ch });
      i++;
      continue;
    }
    throw new Error(`수식 토큰 오류: '${ch}' in ${src}`);
  }
  toks.push({ k: "eof", v: "" });
  return toks;
}

const CELL_RE = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;
const COL_RE = /^\$?([A-Za-z]{1,3})$/;
const ROW_RE = /^\$?(\d+)$/;

export function parseFormula(src: string): Ast {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expectOp = (v: string) => {
    const t = next();
    if (t.k !== "op" || t.v !== v) throw new Error(`'${v}' 예상, 실제 '${t.v}' in ${src}`);
  };

  function parseComparison(): Ast {
    let a = parseConcat();
    for (;;) {
      const t = peek();
      if (t.k === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(t.v)) {
        next();
        const b = parseConcat();
        a = { t: "bin", op: t.v, a, b };
      } else return a;
    }
  }
  function parseConcat(): Ast {
    let a = parseAdd();
    for (;;) {
      const t = peek();
      if (t.k === "op" && t.v === "&") {
        next();
        a = { t: "bin", op: "&", a, b: parseAdd() };
      } else return a;
    }
  }
  function parseAdd(): Ast {
    let a = parseMul();
    for (;;) {
      const t = peek();
      if (t.k === "op" && (t.v === "+" || t.v === "-")) {
        next();
        a = { t: "bin", op: t.v, a, b: parseMul() };
      } else return a;
    }
  }
  function parseMul(): Ast {
    let a = parsePow();
    for (;;) {
      const t = peek();
      if (t.k === "op" && (t.v === "*" || t.v === "/")) {
        next();
        a = { t: "bin", op: t.v, a, b: parsePow() };
      } else return a;
    }
  }
  function parsePow(): Ast {
    let a = parseUnary();
    for (;;) {
      const t = peek();
      if (t.k === "op" && t.v === "^") {
        next();
        a = { t: "bin", op: "^", a, b: parseUnary() };
      } else return a;
    }
  }
  function parseUnary(): Ast {
    const t = peek();
    if (t.k === "op" && (t.v === "-" || t.v === "+")) {
      next();
      const a = parseUnary();
      return t.v === "-" ? { t: "un", op: "-", a } : a;
    }
    return parsePostfix();
  }
  function parsePostfix(): Ast {
    let a = parsePrimary();
    for (;;) {
      const t = peek();
      if (t.k === "op" && t.v === "%") {
        next();
        a = { t: "bin", op: "/", a, b: { t: "num", v: 100 } };
      } else return a;
    }
  }
  function parseRefPart(id: string, sheet?: string): Ast {
    // id 는 셀/열/행/이름
    const m = CELL_RE.exec(id);
    if (m) {
      const col = colToNum(m[1]);
      const row = parseInt(m[2], 10);
      // 범위?
      const t = peek();
      if (t.k === "op" && t.v === ":") {
        next();
        const t2 = next();
        const m2 = CELL_RE.exec(t2.v);
        if (t2.k !== "id" || !m2) throw new Error("범위 끝 오류 in " + src);
        return { t: "range", sheet, c1: col, r1: row, c2: colToNum(m2[1]), r2: parseInt(m2[2], 10) };
      }
      return { t: "ref", sheet, col, row };
    }
    const t = peek();
    // 행 전체 $1:$1048576
    const mr = ROW_RE.exec(id);
    if (mr && t.k === "op" && t.v === ":") {
      next();
      const t2 = next();
      const m2 = ROW_RE.exec(t2.v);
      if (!m2) throw new Error("행 범위 오류 in " + src);
      return { t: "range", sheet, c1: 1, r1: parseInt(mr[1], 10), c2: MAX_COL, r2: parseInt(m2[1], 10) };
    }
    // 열 전체 E:E
    const mc = COL_RE.exec(id);
    if (mc && t.k === "op" && t.v === ":") {
      next();
      const t2 = next();
      const m2 = COL_RE.exec(t2.v);
      if (!m2) throw new Error("열 범위 오류 in " + src);
      return { t: "range", sheet, c1: colToNum(mc[1]), r1: 1, c2: colToNum(m2[1]), r2: MAX_ROW };
    }
    return { t: "name", v: id };
  }
  function parsePrimary(): Ast {
    const t = next();
    if (t.k === "num") {
      // 행 전체 범위 1:1048576
      const t2 = peek();
      if (t2.k === "op" && t2.v === ":") {
        next();
        const t3 = next();
        if (t3.k !== "num") throw new Error("행 범위 오류 in " + src);
        return { t: "range", c1: 1, r1: parseInt(t.v, 10), c2: MAX_COL, r2: parseInt(t3.v, 10) };
      }
      return { t: "num", v: parseFloat(t.v) };
    }
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "err") return { t: "err", v: t.v.replace(/[!?]$/, "") === "#REF" ? "#REF!" : t.v };
    if (t.k === "op" && t.v === "(") {
      const a = parseComparison();
      expectOp(")");
      return a;
    }
    if (t.k === "id") {
      let id = t.v;
      // 시트 참조?
      const t2 = peek();
      if (t2.k === "op" && t2.v === "!") {
        next();
        const sheet = id.startsWith("'") ? id.slice(1, -1) : id;
        const t3 = next();
        if (t3.k === "err") return { t: "err", v: "#REF!" };
        if (t3.k === "num") {
          // Sheet!1:5 형태
          const t4 = peek();
          if (t4.k === "op" && t4.v === ":") {
            next();
            const t5 = next();
            return { t: "range", sheet, c1: 1, r1: parseInt(t3.v, 10), c2: MAX_COL, r2: parseInt(t5.v, 10) };
          }
        }
        if (t3.k !== "id") throw new Error("시트 참조 오류 in " + src);
        return parseRefPart(t3.v, sheet);
      }
      // 함수 호출?
      if (t2.k === "op" && t2.v === "(") {
        next();
        const args: Ast[] = [];
        if (!(peek().k === "op" && peek().v === ")")) {
          for (;;) {
            const pk = peek();
            if (pk.k === "op" && (pk.v === "," || pk.v === ";" || pk.v === ")")) {
              // 빈 인수 (예: IF(x,1,) )
              args.push({ t: "empty" });
            } else args.push(parseComparison());
            const s = peek();
            if (s.k === "op" && (s.v === "," || s.v === ";")) {
              next();
              continue;
            }
            break;
          }
        }
        expectOp(")");
        return { t: "call", fn: id.toUpperCase(), args };
      }
      if (id.toUpperCase() === "TRUE") return { t: "bool", v: true };
      if (id.toUpperCase() === "FALSE") return { t: "bool", v: false };
      // 행 전체 참조 (숫자 id는 num 토큰이라 여기 안 옴)
      if (ROW_RE.test(id)) {
        id = id.replace("$", "");
      }
      return parseRefPart(id);
    }
    throw new Error(`수식 파싱 오류: 예상치 못한 토큰 '${t.v}' in ${src}`);
  }

  const ast = parseComparison();
  if (peek().k !== "eof") throw new Error(`수식 끝에 잔여 토큰 '${peek().v}' in ${src}`);
  return ast;
}
