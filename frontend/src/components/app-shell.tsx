"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "./command-palette";
import { Icon, type IconName } from "./icon";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Tìm kiếm", icon: "search" },
  { href: "/servers", label: "Servers", icon: "server" },
  { href: "/catalog", label: "Projects & tags", icon: "layers" },
  { href: "/service-types", label: "Service types", icon: "grid" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentPage = navigation.find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))?.label
    ?? (pathname === "/services/new" ? "Thêm service" : pathname.endsWith("/edit") ? "Chỉnh sửa service" : "Chi tiết service");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="app-sidebar border-b border-border lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5 lg:px-6 lg:py-7">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent"><Icon name="layers" /></span>
            PortAtlas
          </Link>
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted lg:hidden">Registry</span>
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted transition hover:border-accent/50 hover:text-foreground">
            <Icon name="search" className="shrink-0" /><span>Tìm nhanh…</span><kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
          </button>
        </div>
        <nav aria-label="Điều hướng chính" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-surface-hover font-medium text-foreground" : "text-muted hover:bg-surface-raised hover:text-foreground"}`}>
              <Icon name={item.icon} className={active ? "text-accent" : "text-subtle"} />{item.label}
            </Link>;
          })}
        </nav>
        <div className="mt-auto hidden px-5 pb-6 lg:block">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-foreground">Mọi service, một nơi.</p>
            <p className="mt-2 text-xs leading-5 text-muted">Tra cứu IP, port, model và các lệnh vận hành trong registry.</p>
            <Link href="/services/new" className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-accent-strong px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"><Icon name="plus" width="14" height="14" />Thêm service</Link>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 text-sm"><span className="hidden text-subtle sm:inline">Workspace</span><span className="hidden text-subtle sm:inline">/</span><span className="truncate font-medium">{currentPage}</span></div>
          <Link href="/services/new" className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition hover:border-accent/50 hover:bg-surface-raised"><Icon name="plus" width="15" height="15" />Thêm service</Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 outline-none sm:px-8 sm:py-10">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
