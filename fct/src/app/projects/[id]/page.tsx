import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getProject, isProjectEditor, listAssignableUsers, listProjectMembers, listSnapshots } from "@/lib/data";
import { projectAccess } from "@/lib/access";
import { ProjectStore } from "@/components/ProjectStore";
import WizardShell from "@/components/wizard/WizardShell";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const lang = await getLang();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isFinite(pid)) notFound();
  const project = await getProject(pid);
  if (!project) notFound();

  const access = projectAccess(session, project, await isProjectEditor(pid, session.id));
  const [snapshots, members, users] = await Promise.all([
    listSnapshots(pid),
    access.canManage ? listProjectMembers(pid) : Promise.resolve([]),
    access.canManage ? listAssignableUsers() : Promise.resolve([]),
  ]);

  return (
    <ProjectStore projectId={pid} templateId={project.template_id} initialOverrides={project.overrides} lang={lang} canEdit={access.canEdit}>
      <WizardShell
        project={project}
        snapshots={snapshots}
        canDelete={access.canManage}
        access={access}
        members={members}
        users={users.filter((u) => u.id !== project.created_by)}
      />
    </ProjectStore>
  );
}
