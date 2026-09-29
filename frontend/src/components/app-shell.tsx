"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
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
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <Link href="/" className="mr-auto text-xl font-bold tracking-tight">Port<span className="text-blue-600">Atlas</span></Link>
          <nav aria-label="Điều hướng chính" className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm sm:order-2 sm:w-auto">
            <Link href="/servers" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Servers</Link>
            <Link href="/catalog" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Projects & tags</Link>
            <Link href="/service-types" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Service types</Link>
            <Link href="/services/new" className="rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-50">+ Service</Link>
          </nav>
          <button type="button" onClick={() => setPaletteOpen(true)} className="order-2 flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-700 sm:order-3"><span>Search</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">Ctrl K</kbd></button>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
