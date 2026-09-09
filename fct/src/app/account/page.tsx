import { requireSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import PasswordForm from "./PasswordForm";
import { fcmOrigin } from '@/lib/fcm-session';

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  return (
    <main className="shell max-w-[520px]">
      <h1 className="mb-1 text-lg font-bold text-slate-900">{t("account")}</h1>
      <div className="mb-4 text-[12px] text-slate-500">
        {s.username} · {s.role}
      </div>
      {s.authProvider === 'fcm' ? <p>{lang === 'ko' ? '이 계정은 FCM에서 관리합니다.' : 'This account is managed in FCM.'} <a href={`${fcmOrigin()}/workspace`}>{lang === 'ko' ? '통합 메뉴로 돌아가기' : 'Return to workspace'}</a></p> : <PasswordForm labels={{ title: t("changePassword"), current: t("currentPassword"), nw: t("newPassword"), save: t("save"), ok: t("updated") }} />}
    </main>
  );
}
