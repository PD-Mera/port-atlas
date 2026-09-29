"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useRegistrySearch } from "@/hooks/use-registry-search";
import type { ServiceSummary } from "@/lib/types";

type CommandPaletteProps = { open: boolean; onOpenChange: (open: boolean) => void };

function unique(items: ServiceSummary[]): ServiceSummary[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const { data, loading, error } = useRegistrySearch(query, open);
  const results = useMemo(() => data?.items ?? [], [data]);
  const suggestions = useMemo(() => unique([...(data?.recent ?? []), ...(data?.frequent ?? [])]), [data]);
  const navigable = query.trim() ? results : suggestions;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setSelected(0);
    setQuery("");
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea");
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [open]);

  const close = () => onOpenChange(false);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(value + 1, Math.max(navigable.length - 1, 0))); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); }
    if (event.key === "Enter" && navigable[selected]) { event.preventDefault(); close(); router.push(`/services/${navigable[selected].id}`); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tìm service" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="border-b border-border p-4">
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} onKeyDown={onKeyDown} placeholder="Tìm service, model, IP, port, project hoặc tag…" className="w-full bg-transparent text-lg text-foreground outline-none" aria-label="Tìm service" />
          <p className="mt-2 text-xs text-subtle">↑ ↓ để chọn · Enter để mở · Esc để đóng</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading && <p className="px-3 py-4 text-sm text-muted">Đang tìm…</p>}
          {error && <p role="alert" className="px-3 py-4 text-sm text-danger">{error}</p>}
          {!loading && !error && navigable.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">Chưa có service phù hợp.</p>}
          {!query.trim() && data?.recent && data.recent.length > 0 && <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-subtle">Gần đây</p>}
          {navigable.map((service, index) => (
            <Link key={service.id} href={`/services/${service.id}`} onClick={close} className={`block rounded-lg px-3 py-3 ${index === selected ? "bg-accent-soft" : "hover:bg-surface-raised"}`}>
              <div className="flex items-center justify-between gap-3"><span className="font-medium text-foreground">{service.name}</span><span className="text-xs text-muted">{service.server_ip}</span></div>
              <p className="mt-1 text-xs text-muted">{service.server_name}{service.project ? ` · ${service.project}` : ""}{service.ports.length ? ` · ${service.ports.map((port) => port.port).join(", ")}` : ""}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
