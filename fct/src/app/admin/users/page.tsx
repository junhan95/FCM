import { requireAdmin } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { listUsers } from "@/lib/data";
import { createUserAction, updateUserAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAdmin();
  const lang = await getLang();
  const t = makeT(lang);
  const users = await listUsers();
  return (
    <main className="shell">
      <h1 className="mb-3 page-title">{t("users")}</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <table className="tbl w-full text-[12px]">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("username")}</th>
                <th>{t("name")}</th>
                <th>{t("role")}</th>
                <th>{t("active")}</th>
                <th>{t("newPassword")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-slate-400">{u.id}</td>
                  <td className="font-medium">{u.username}</td>
                  <td colSpan={5}>
                    <form action={updateUserAction.bind(null, u.id)} className="flex items-center gap-2">
                      <input name="name" defaultValue={u.name} className="field w-40" />
                      <select name="role" defaultValue={u.role} className="field w-28" disabled={u.id === me.id}>
                        <option>USER</option>
                        <option>ADMIN</option>
                      </select>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === me.id} /> {t("active")}
                      </label>
                      <input name="password" type="password" className="field w-40" placeholder="(reset)" autoComplete="new-password" />
                      <button className="btn-secondary">{t("save")}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createUserAction} className="card space-y-2 p-4">
          <h2 className="text-[13px] font-semibold">+ {t("users")}</h2>
          <input name="username" className="field" placeholder={t("username")} required />
          <input name="name" className="field" placeholder={t("name")} />
          <input name="password" type="password" className="field" placeholder={t("password") + " (6+)"} required minLength={6} autoComplete="new-password" />
          <select name="role" className="field" defaultValue="USER">
            <option>USER</option>
            <option>ADMIN</option>
          </select>
          <button className="btn w-full justify-center">{t("create")}</button>
        </form>
      </div>
    </main>
  );
}
