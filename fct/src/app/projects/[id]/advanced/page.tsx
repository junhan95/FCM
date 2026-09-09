import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { getProject, getTemplate, listSnapshots } from "@/lib/data";
import { ProjectStore } from "@/components/ProjectStore";
import TotalView from "@/components/TotalView";
import { sheetSlug } from "@/lib/slug";
import ProjectMeta from "./ProjectMeta";

export const dynamic = "force-dynamic";

/** 엑셀형 상세 화면 — Total 집계표 + 시트 목록 (엔지니어링 검토·예외 처리용) */
export default async function AdvancedPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isFinite(pid)) notFound();
  const project = await getProject(pid);
  if (!project) notFound();
  const [tpl, snapshots] = await Promise.all([getTemplate(project.template_id), listSnapshots(pid)]);
  const sheets = tpl.json.order.filter((s) => s !== "Total" && !tpl.json.sheets[s].hidden);

  return (
    <ProjectStore projectId={pid} templateId={project.template_id} initialOverrides={project.overrides} lang={lang}>
      <div className="border-b border-slate-200 bg-white px-4 py-1.5">
        <Link href={`/projects/${pid}`} className="text-[12px] font-medium text-brand hover:underline">
          {t("wizardView")}
        </Link>
      </div>
      <TotalView projectName={project.name} />
      <div className="shell pt-0 pb-8">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <ProjectMeta project={project} snapshots={snapshots} canDelete={session.role === "ADMIN" || project.created_by === session.id} lang={lang} />
          <section className="card p-3">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("chambers")}</h2>
            <div className="flex flex-wrap gap-1.5">
              {sheets.map((s) => (
                <Link key={s} href={`/projects/${pid}/sheet/${sheetSlug(s)}`} className="rounded border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 hover:border-brand hover:text-brand">
                  {s.trim()}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </ProjectStore>
  );
}
