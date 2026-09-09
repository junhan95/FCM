import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { listProjects, countProjects, getDefaultTemplate } from "@/lib/data";
import DeleteProjectDialog from "@/components/DeleteProjectDialog";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  OFFERED: "bg-sky-100 text-sky-800",
  ORDERED: "bg-emerald-100 text-emerald-800",
  LOST: "bg-red-100 text-red-800",
  ARCHIVED: "bg-slate-200 text-slate-500",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string; q?: string; f?: string }> }) {
  const session = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const field = sp.f ?? "";
  const [projects, total, tpl] = await Promise.all([listProjects(q, field), countProjects(), getDefaultTemplate()]);
  const searching = q.length > 0;

  return (
    <main className="shell">
      {sp.denied && <div className="mb-4 rounded bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{t("denied")}</div>}
      <div>
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="page-title">{t("projects")}</h1>
            <span className="text-[12px] text-slate-500">
              {t("templateVersion")}: {tpl.version}
            </span>
          </div>
          <div className="card overflow-hidden">
            <div className="card-head">
              <span className="card-title">{t("projects")}</span>
              <span className="card-sub">
                {projects.length}
                {searching && ` / ${total}`}
              </span>
            </div>

            {/* 검색 — 자바스크립트 없이 주소로 넘긴다 (주소를 그대로 공유할 수 있다) */}
            <form method="get" action="/" className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <select name="f" defaultValue={field} className="field !w-32 shrink-0">
                <option value="">{t("searchAll")}</option>
                <option value="name">{t("projectName")}</option>
                <option value="customer">{t("customer")}</option>
                <option value="country">{t("country")}</option>
                <option value="quotation">{t("quotationNo")}</option>
                <option value="status">{t("status")}</option>
                <option value="editor">{t("editor")}</option>
              </select>
              <input
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t("searchPlaceholder")}
                className="field min-w-[140px] flex-1"
              />
              <button className="btn shrink-0">{t("search")}</button>
              {searching && (
                <Link href="/" className="btn-secondary shrink-0">
                  {t("searchClear")}
                </Link>
              )}
            </form>

            <table className="tbl w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("projectName")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("country")}</th>
                  <th>{t("quotationNo")}</th>
                  <th>{t("status")}</th>
                  <th>{t("editor")}</th>
                  <th>{t("updatedAt")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      {searching ? t("searchNoResult") : t("noProjects")}
                    </td>
                  </tr>
                )}
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="text-slate-400">{p.id}</td>
                    <td>
                      <Link href={`/projects/${p.id}`} className="font-medium text-sky-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.customer}</td>
                    <td>{p.country}</td>
                    <td>
                      {p.quotation_no}
                      {p.revision && <span className="text-slate-400"> / {p.revision}</span>}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLOR[p.status] ?? "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                    </td>
                    <td>{p.editor}</td>
                    <td className="text-slate-500">{new Date(p.updated_at).toLocaleString()}</td>
                    <td className="text-right">
                      {(session.role === "ADMIN" || p.created_by === session.id) && (
                        <DeleteProjectDialog projectId={p.id} projectName={p.name} lang={lang} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
