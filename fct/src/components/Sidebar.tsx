"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";

interface Labels {
  newProject: string;
  projects: string;
  priceDb: string;
  users: string;
  account: string;
  logout: string;
  language: string;
  langOther: string;
  resizeHint: string;
}

const NavIcon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  newProject: "M12 5v14M5 12h14",
  projects: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  prices: "M4 5h16M4 12h16M4 19h16M8 5v14M14 5v14",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  account: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  lang: "M3 5h12M9 3v2c0 4.4-2.7 8.3-6 10M5 9c1.5 3 4 5.5 7 7M14 21l4-9 4 9M15.5 17.5h5",
  collapse: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  expand: "M13 17l5-5-5-5M6 17l5-5-5-5",
};

export default function Sidebar({
  user,
  labels,
  onLogout,
  onToggleLang,
  workspace,
}: {
  user: SessionUser;
  labels: Labels;
  onLogout: () => Promise<void>;
  onToggleLang: () => Promise<void>;
  workspace?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(220);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const MIN_W = 170, MAX_W = 400, COLLAPSED_W = 60;

  // 저장된 접힘 상태/폭 복원 (하이드레이션 후)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem("fct_sidebar") === "collapsed");
        const w = Number(localStorage.getItem("fct_sidebar_w"));
        if (w >= MIN_W && w <= MAX_W) setWidth(w);
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // 드래그로 폭 조절
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const w = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setWidth(w);
      document.documentElement.style.setProperty("--sidebar-w", w + "px");
    };
    const up = (e: MouseEvent) => {
      setDragging(false);
      const w = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      try {
        localStorage.setItem("fct_sidebar_w", String(w));
      } catch {}
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", (collapsed ? COLLAPSED_W : width) + "px");
  }, [collapsed, width]);

  const toggle = () => {
    const c = !collapsed;
    setCollapsed(c);
    try {
      localStorage.setItem("fct_sidebar", c ? "collapsed" : "open");
    } catch {}
  };

  const items = [
    { href: "/projects/new", label: labels.newProject, icon: ICONS.newProject, active: pathname === "/projects/new" },
    {
      href: "/",
      label: labels.projects,
      icon: ICONS.projects,
      active: pathname === "/" || (pathname.startsWith("/projects") && pathname !== "/projects/new"),
    },
    ...(user.role === "ADMIN"
      ? [
          { href: "/admin/prices", label: labels.priceDb, icon: ICONS.prices, active: pathname.startsWith("/admin/prices") },
          { href: "/admin/users", label: labels.users, icon: ICONS.users, active: pathname.startsWith("/admin/users") },
        ]
      : []),
  ];

  const initials = (user.name || user.username).slice(0, 2).toUpperCase();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white ${dragging ? "" : "transition-[width] duration-150"}`}
      style={{ width: collapsed ? COLLAPSED_W : width }}
    >
      {/* 폭 조절 손잡이 (펼친 상태에서 오른쪽 가장자리를 드래그) */}
      {!collapsed && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => {
            setWidth(220);
            try {
              localStorage.setItem("fct_sidebar_w", "220");
            } catch {}
          }}
          title={labels.resizeHint}
          className="absolute inset-y-0 -right-1 z-50 w-2 cursor-col-resize hover:bg-brand/30"
        />
      )}
      {/* 접기/펼치기 (상단) */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expand" : "Collapse"}
        className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-brand hover:text-brand"
      >
        <NavIcon d={collapsed ? ICONS.expand : ICONS.collapse} />
      </button>
      {/* 로고 */}
      <Link href="/" className={`flex h-14 items-center gap-2 border-b border-slate-100 ${collapsed ? "justify-center px-0" : "px-4"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/frankonia-mark.svg" alt="" className="h-7 w-auto" />
        {!collapsed && (
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">Frankonia</span>
            <span className="text-[13px] font-semibold text-brand">Calculation Table</span>
          </span>
        )}
      </Link>

      {/* 메뉴 */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {workspace && <a href={workspace.href} title={workspace.label} className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 ${collapsed ? 'justify-center' : ''}`}><NavIcon d="M9 5l-7 7 7 7M2 12h20"/>{!collapsed && <span>{workspace.label}</span>}</a>}
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
              it.active ? "bg-red-50 text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <NavIcon d={it.icon} />
            {!collapsed && <span>{it.label}</span>}
          </Link>
        ))}
      </nav>


      {/* 사용자 */}
      <div ref={menuRef} className="relative border-t border-slate-100 p-2">
        {menuOpen && (
          <div className="absolute bottom-full left-2 mb-1 w-52 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
            <div className="px-2.5 py-2 text-[12px]">
              <div className="font-semibold text-slate-800">{user.name || user.username}</div>
              <div className="text-slate-500">
                {user.username} · {user.role}
              </div>
            </div>
            <div className="my-1 border-t border-slate-100" />
            <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100">
              <NavIcon d={ICONS.account} /> {labels.account}
            </Link>
            <button type="button" onClick={() => void onToggleLang()} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100">
              <NavIcon d={ICONS.lang} /> {labels.language} → {labels.langOther}
            </button>
            <button type="button" onClick={() => void onLogout()} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-100">
              <NavIcon d={ICONS.logout} /> {labels.logout}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-100 ${collapsed ? "justify-center" : ""}`}
          title={user.name || user.username}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">{initials}</span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-800">{user.name || user.username}</span>
              <span className="block text-[11px] text-slate-500">{user.role}</span>
            </span>
          )}
          {!collapsed && <span className="text-slate-400">⋯</span>}
        </button>
      </div>
    </aside>
  );
}
