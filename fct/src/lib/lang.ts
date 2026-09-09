import { cookies } from "next/headers";
import { Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("fct_lang")?.value;
  return c === "en" ? "en" : "ko";
}
