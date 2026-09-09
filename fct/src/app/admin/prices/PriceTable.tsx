"use client";

import { useMemo, useState } from "react";
import { Lang, makeT } from "@/lib/i18n";
import { createPriceAction, updatePriceAction } from "@/app/actions/admin";
import { buildPriceTree, entryMatches, PriceEntry, PriceRowView } from "@/lib/price-tree";

export type { PriceRowView };

/** 한 줄짜리 값 입력 (Ref·단위·단가·납기·일자) */
function EditCell({ value, onCommit, numeric = false, className = "" }: { value: string; onCommit: (v: string) => void; numeric?: boolean; className?: string }) {
  const [draft, setDraft] = useState(value);
  const [orig, setOrig] = useState(value);
  if (orig !== value) {
    setOrig(value);
    setDraft(value);
  }
  return (
    <input
      className={`cell-input ${numeric ? "" : "text"} ${className}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** 내용 길이에 맞춰 자동으로 늘어나는 입력 — 품목명·설명 전문을 보여 준다 */
function GrowCell({ value, onCommit, muted = false }: { value: string; onCommit: (v: string) => void; muted?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [orig, setOrig] = useState(value);
  if (orig !== value) {
    setOrig(value);
    setDraft(value);
  }
  return (
    <span className={`grow ${muted ? "muted" : ""}`} data-val={draft}>
      <textarea
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
    </span>
  );
}

/** 카테고리 카드가 19개로 나뉘어도 열이 같은 자리에 오도록 폭을 고정한다 */
const PRICE_COLS = ["56px", "96px", "96px", "minmax(0,1.1fr)", "minmax(0,1.4fr)", "72px", "96px", "88px", "104px"];
const PriceCols = () => (
  <colgroup>
    {PRICE_COLS.map((w, i) => (
      <col key={i} style={{ width: w }} />
    ))}
  </colgroup>
);

const namedGroups = (c: { groups: { name: string }[] }) => c.groups.filter((g) => g.name).length;

/** 카테고리·하위 그룹 선택 버튼 */
function Chip({
  children,
  no,
  count,
  on = false,
  onClick,
}: {
  children: React.ReactNode;
  no?: string;
  count?: number;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip ${on ? "chip-on" : ""}`}
    >
      {no !== undefined && (
        <span className={`rounded px-1 text-[10px] font-bold ${on ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-400"}`}>{no}</span>
      )}
      <span>{children}</span>
      {count !== undefined && <span className={`text-[10px] ${on ? "text-brand/70" : "text-slate-400"}`}>{count}</span>}
    </button>
  );
}

type Edits = Record<number, Partial<PriceRowView>>;
type View = (r: PriceRowView) => PriceRowView;
type Commit = (id: number, fields: Parameters<typeof updatePriceAction>[1]) => void;

function Cells({ r, muted, view, commit }: { r: PriceRowView; muted?: boolean; view: View; commit: Commit }) {
  const v = view(r);
  return (
    <>
      <td className="align-top text-[11px] text-slate-300">{v.row}</td>
      <td className="align-top font-mono text-[11px] text-slate-600">{String(v.ref ?? "")}</td>
      <td className="align-top text-[11px] text-slate-400">{v.sage}</td>
      <td className="align-top">
        <GrowCell value={v.item} muted={muted} onCommit={(x) => commit(v.id, { item: x })} />
      </td>
      <td className="align-top">
        <GrowCell value={v.description} muted={muted} onCommit={(x) => commit(v.id, { description: x })} />
      </td>
      <td className="align-top">
        <EditCell value={v.unit} className="text-[11px]" onCommit={(x) => commit(v.id, { unit: x })} />
      </td>
      <td className="align-top">
        <EditCell
          value={v.priceText}
          numeric
          onCommit={(x) => {
            const n = x.trim() === "" ? null : Number(x.replace(",", "."));
            if (n !== null && !Number.isFinite(n)) return;
            commit(v.id, { price: n });
          }}
        />
      </td>
      <td className="align-top">
        <EditCell value={v.delivery} className="text-[11px]" onCommit={(x) => commit(v.id, { delivery: x })} />
      </td>
      <td className="align-top">
        <EditCell value={v.priceDate} className="text-[11px]" onCommit={(x) => commit(v.id, { priceDate: x })} />
      </td>
    </>
  );
}


export default function PriceTable({ rows: initial, categories, lang }: { rows: PriceRowView[]; categories: string[]; lang: Lang }) {
  const t = makeT(lang);
  const [edits, setEdits] = useState<Edits>({});
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // 트리는 서버가 준 원본 순서로 한 번만 만든다 (편집 중 행이 재분류되지 않도록)
  const tree = useMemo(() => buildPriceTree(initial), [initial]);
  const view = (r: PriceRowView): PriceRowView => (edits[r.id] ? { ...r, ...edits[r.id] } : r);

  const qq = q.trim().toLowerCase();
  const searching = qq !== "";

  // 검색어 · 선택한 카테고리/그룹으로 걸러낸 트리
  const shown = useMemo(() => {
    const match = (e: PriceEntry) => entryMatches({ main: view(e.main), extra: e.extra.map(view) }, qq);
    return tree
      .map((c) => {
        if (pick.startsWith("c:") && pick.slice(2) !== c.key) return null;
        const groups = c.groups
          .filter((g) => !pick.startsWith("g:") || pick.slice(2) === g.key)
          .map((g) => ({ ...g, entries: g.entries.filter(match) }))
          .filter((g) => g.entries.length);
        if (!groups.length) return null;
        return { ...c, groups, count: groups.reduce((n, g) => n + g.entries.length, 0) };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, qq, pick, edits]);

  // 지금 열려 있는 카테고리 (카테고리를 골랐거나, 그 안의 그룹을 골랐을 때)
  const openCat =
    pick.startsWith("c:")
      ? (tree.find((c) => c.key === pick.slice(2)) ?? null)
      : pick.startsWith("g:")
        ? (tree.find((c) => c.groups.some((g) => g.key === pick.slice(2))) ?? null)
        : null;

  // 검색 중이거나 특정 그룹을 고르면 자동으로 펼친다
  const isOpen = (key: string) => (searching || pick !== "" ? (open[key] ?? true) : (open[key] ?? false));
  const totalShown = shown.reduce((n, c) => n + c.count, 0);
  const totalAll = tree.reduce((n, c) => n + c.count, 0);

  const commit = async (id: number, fields: Parameters<typeof updatePriceAction>[1]) => {
    setEdits((e) => ({
      ...e,
      [id]: {
        ...e[id],
        ...(fields.item !== undefined ? { item: fields.item ?? "" } : {}),
        ...(fields.description !== undefined ? { description: fields.description ?? "" } : {}),
        ...(fields.unit !== undefined ? { unit: fields.unit ?? "" } : {}),
        ...(fields.price !== undefined ? { price: fields.price, priceText: fields.price == null ? "" : String(fields.price) } : {}),
        ...(fields.delivery !== undefined ? { delivery: fields.delivery ?? "" } : {}),
        ...(fields.priceDate !== undefined ? { priceDate: fields.priceDate ?? "" } : {}),
      },
    }));
    try {
      await updatePriceAction(id, fields);
      setMsg(t("saved"));
    } catch (e) {
      setMsg("Error: " + String(e));
    }
    setTimeout(() => setMsg(null), 1500);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="page-title mr-1">{t("priceDb")}</h1>
        <input className="field !w-64" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field !w-[26rem]" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{t("all")}</option>
          {tree.map((c) => (
            <optgroup key={c.key} label={`${c.no}. ${c.name}`}>
              <option value={`c:${c.key}`}>
                {c.no}. {c.name} — {c.count} {t("itemsCount")}
              </option>
              {c.groups
                .filter((g) => g.name)
                .map((g) => (
                  <option key={g.key} value={`g:${g.key}`}>
                    {"  ↳ "}
                    {g.name} ({g.entries.length})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <span className="text-[12px] text-slate-500">
          {totalShown} / {totalAll} {t("itemsCount")}
        </span>
        <button type="button" className="btn-secondary" onClick={() => setOpen(Object.fromEntries(tree.map((c) => [c.key, true])))}>
          {t("expandAll")}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(Object.fromEntries(tree.map((c) => [c.key, false])))}>
          {t("collapseAll")}
        </button>
        <button type="button" className="btn-secondary ml-auto" onClick={() => setShowAdd((s) => !s)}>
          + {t("addItem")}
        </button>
        {msg && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[12px] text-emerald-700">{msg}</span>}
      </div>

      {/* 하위 그룹 선택 버튼 — 카테고리를 골랐을 때만 나온다 (전체 상태에서는 감춘다) */}
      {openCat && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip onClick={() => setPick("")}>← {t("all")}</Chip>
          <Chip on={pick === `c:${openCat.key}`} no={openCat.no} count={openCat.count} onClick={() => setPick(`c:${openCat.key}`)}>
            {openCat.name}
          </Chip>
          {namedGroups(openCat) > 0 && <span className="self-center px-1 text-slate-300">›</span>}
          {openCat.groups
            .filter((g) => g.name)
            .map((g) => (
              <Chip key={g.key} on={pick === `g:${g.key}`} count={g.entries.length} onClick={() => setPick(`g:${g.key}`)}>
                {g.name}
              </Chip>
            ))}
        </div>
      )}

      {showAdd && (
        <form action={createPriceAction} className="card mb-3 grid grid-cols-2 gap-2 p-3 md:grid-cols-7">
          <input name="ref" className="field" placeholder={t("refPlaceholder")} required />
          <input name="item" className="field md:col-span-2" placeholder={t("item")} required />
          <input name="description" className="field md:col-span-2" placeholder={t("description")} />
          <input name="unit" className="field" placeholder={t("unit")} />
          <input name="price" className="field" placeholder={t("price")} type="number" step="0.01" required />
          <select name="category" className="field md:col-span-3">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn md:col-span-1">{t("create")}</button>
        </form>
      )}

      {shown.length === 0 && <div className="card p-8 text-center text-[13px] text-slate-500">{t("noResults")}</div>}

      <div className="space-y-2">
        {shown.map((c) => {
          const opened = isOpen(c.key);
          return (
            <section key={c.key} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [c.key]: !opened }))}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="w-3 text-[15px] text-slate-400">{opened ? "▾" : "▸"}</span>
                <span className="w-7 shrink-0 rounded bg-slate-100 text-center text-[12px] font-bold text-slate-500">{c.no}</span>
                <span className="text-[14px] font-semibold text-slate-800">{c.name}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                  {c.count} {t("itemsCount")}
                </span>
                {namedGroups(c) > 0 && (
                  <span className="text-[11px] text-slate-400">
                    {namedGroups(c)} {t("groupsCount")}
                  </span>
                )}
                <span className="ml-auto font-mono text-[11px] text-slate-300">
                  row {c.minRow}–{c.maxRow}
                </span>
              </button>

              {opened && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="tbl tbl-fixed w-full text-[12px]">
                    <PriceCols />
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>{t("ref")}</th>
                        <th>Sage</th>
                        <th>{t("item")}</th>
                        <th>{t("description")}</th>
                        <th>{t("unit")}</th>
                        <th className="text-right">{t("price")}</th>
                        <th>Delivery</th>
                        <th>{t("priceDate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.groups.map((g) => (
                        <GroupBody key={g.key} name={g.name} entries={g.entries} view={view} commit={commit} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** 하위 그룹 제목 + 그 안의 품목들 (품목마다 딸린 설명 줄을 아래에 붙여 전문을 보여 준다) */
function GroupBody({ name, entries, view, commit }: { name: string; entries: PriceEntry[]; view: View; commit: Commit }) {
  return (
    <>
      {name && (
        <tr className="section">
          <td></td>
          <td colSpan={8} className="text-[12px]">
            {name}
          </td>
        </tr>
      )}
      {entries.map((e) => (
        <EntryRows key={e.main.id} entry={e} view={view} commit={commit} />
      ))}
    </>
  );
}

function EntryRows({ entry, view, commit }: { entry: PriceEntry; view: View; commit: Commit }) {
  return (
    <>
      <tr className="border-t border-slate-200 hover:bg-sky-50/30">
        <Cells r={entry.main} view={view} commit={commit} />
      </tr>
      {entry.extra.map((x) => (
        <tr key={x.id} className="bg-slate-50/40">
          <Cells r={x} muted view={view} commit={commit} />
        </tr>
      ))}
    </>
  );
}
