import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { fcmOrigin } from '@/lib/fcm-session';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getSession();
  if (s) redirect("/");
  if (process.env.FCM_BRIDGE_SECRET) redirect(`${fcmOrigin()}/login`);
  const lang = await getLang();
  const t = makeT(lang);
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-slate-100">
      <div className="card w-[380px] p-8">
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/frankonia-logo.svg" alt="Frankonia" className="h-24 w-auto" />
          <h1 className="mt-4 text-[15px] font-semibold tracking-wide text-slate-800">Calculation Table</h1>
          <div className="text-[11px] text-slate-500">EMC chamber quotation</div>
        </div>
        <LoginForm
          next={next ?? "/"}
          labels={{ username: t("username"), password: t("password"), login: t("login"), failed: t("loginFailed") }}
        />
      </div>
      <p className="mt-6 w-[440px] text-center text-[12px] leading-relaxed text-slate-500">
        {t("loginNotice")}
        <br />
        {t("loginContact")}{" "}
        <a href="mailto:Daniel.Feyerlein@frankoniagroup.com" className="font-medium text-brand hover:underline">
          Daniel.Feyerlein@frankoniagroup.com
        </a>
      </p>
    </main>
  );
}
