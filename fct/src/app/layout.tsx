import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";
import { logoutAction, setLangAction } from "./actions/auth";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Frankonia Calculation Table",
  description: "Frankonia EMC chamber quotation calculation",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const lang = await getLang();
  const t = makeT(lang);

  async function toggleLang() {
    "use server";
    const current = await getLang();
    await setLangAction(current === "ko" ? "en" : "ko");
  }

  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full">
        {session ? (
          <>
            <Sidebar
              user={session}
              labels={{
                newProject: t("newProject"),
                projects: t("projects"),
                priceDb: t("priceDb"),
                users: t("users"),
                account: t("account"),
                logout: t("logout"),
                language: t("language"),
                langOther: t("langOther"),
                resizeHint: t("sidebarResizeHint"),
              }}
              onLogout={logoutAction}
              onToggleLang={toggleLang}
            />
            <div className="min-h-screen transition-[padding] duration-150" style={{ paddingLeft: "var(--sidebar-w, 220px)" }}>
              {children}
            </div>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
