import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { getDefaultTemplate } from "@/lib/data";
import { createProjectAction } from "@/app/actions/projects";
import ImportExcel from "@/components/ImportExcel";

export const dynamic = "force-dynamic";

/** 새 프로젝트 — 직접 입력하거나 엑셀 견적서를 불러와 만든다 */
export default async function NewProjectPage() {
  const session = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  const tpl = await getDefaultTemplate();

  return (
    <main className="shell">
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="page-title">{t("newProject")}</h1>
        <span className="text-[12px] text-slate-500">
          {t("templateVersion")}: {tpl.version}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <form action={createProjectAction} className="card space-y-3 p-4">
          <h2 className="card-title">{t("newProjectManual")}</h2>
          <div>
            <label className="mb-1 block text-[12px] text-slate-600">{t("projectName")} *</label>
            <input name="name" className="field" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[12px] text-slate-600">{t("customer")}</label>
              <input name="customer" className="field" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-slate-600">{t("country")}</label>
              <input name="country" className="field" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-slate-600">{t("quotationNo")}</label>
              <input name="quotationNo" className="field" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-slate-600">{t("revision")}</label>
              <input name="revision" className="field" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-slate-600">{t("editor")}</label>
            <input name="editor" className="field" defaultValue={session.name || session.username} />
          </div>
          <button className="btn w-full justify-center">{t("create")}</button>
        </form>

        <ImportExcel lang={lang} defaultEditor={session.name || session.username} />
      </div>
    </main>
  );
}
