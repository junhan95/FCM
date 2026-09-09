"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/ProjectStore";

export default function SheetNav({
  projectId,
  sheets,
  current,
  projectName,
}: {
  projectId: number;
  sheets: { name: string; slug: string }[];
  current: string;
  projectName: string;
}) {
  const router = useRouter();
  const { saveState, saveNow } = useProject();
  const go = async (slug: string) => {
    if (saveState === "unsaved") await saveNow();
    router.push(`/projects/${projectId}/sheet/${slug}`);
  };
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[var(--shell)] items-center gap-3 px-5 py-1.5 text-[12px]">
        <Link href={`/projects/${projectId}`} className="font-medium text-slate-700 hover:text-sky-700">
          {projectName}
        </Link>
        <span className="text-slate-300">/</span>
        <select className="field !w-72 !py-1" value={current} onChange={(e) => void go(e.target.value)}>
          {sheets.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name.trim()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
