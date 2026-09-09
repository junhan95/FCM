import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getProject, getTemplate } from "@/lib/data";
import { ProjectStore } from "@/components/ProjectStore";
import SheetEditor from "@/components/SheetEditor";
import { sheetSlug } from "@/lib/slug";
import SheetNav from "./SheetNav";

export const dynamic = "force-dynamic";

export default async function SheetPage({ params }: { params: Promise<{ id: string; sheet: string }> }) {
  await requireSession();
  const lang = await getLang();
  const { id, sheet } = await params;
  const pid = Number(id);
  if (!Number.isFinite(pid)) notFound();
  const project = await getProject(pid);
  if (!project) notFound();
  const tpl = await getTemplate(project.template_id);
  const name = tpl.json.order.find((s) => sheetSlug(s) === sheet && s !== "Total");
  if (!name) notFound();
  const sheets = tpl.json.order.filter((s) => s !== "Total" && !tpl.json.sheets[s].hidden).map((s) => ({ name: s, slug: sheetSlug(s) }));

  return (
    <ProjectStore projectId={pid} templateId={project.template_id} initialOverrides={project.overrides} lang={lang}>
      <SheetNav projectId={pid} sheets={sheets} current={sheet} projectName={project.name} />
      <SheetEditor sheet={name} />
    </ProjectStore>
  );
}
