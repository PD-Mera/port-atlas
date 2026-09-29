"use client";

import { useEffect, useState } from "react";
import { listServices } from "@/lib/api";
import type { ServiceReference } from "@/lib/types";
import { inputClass } from "./ui";

export function DependencyPicker({ serviceId, ids, initial = [], onChange }: {
  serviceId?: string;
  ids: string[];
  initial?: ServiceReference[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ServiceReference[]>([]);
  const [known, setKnown] = useState<Record<string, ServiceReference>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await listServices({ q: query, page, page_size: 20, signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(result.items.filter((item) => item.id !== serviceId));
        setTotal(result.total);
        setKnown((current) => ({ ...current, ...Object.fromEntries(result.items.map((item) => [item.id, item])) }));
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Không tải được dịch vụ");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, page, serviceId, retry]);

  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="text-lg font-semibold">Phụ thuộc vào</h2>
    <p className="mt-1 text-sm text-muted">Chọn các dịch vụ cần thiết cho dịch vụ này, kể cả trên server khác.</p>
    <ul className="mt-4 space-y-2">
      {ids.map((id) => {
        const item = known[id] ?? initial.find((candidate) => candidate.id === id);
        const ports = item?.ports ?? [];
        return <li key={id} className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">
          <span className="min-w-0">{item ? <><span>{item.name} · {item.server_name} · {item.server_ip}</span><span className="block break-words text-xs text-muted">Port: {ports.length ? ports.map((port) => `${port.name}: ${port.port}/${port.protocol}`).join(", ") : "Chưa khai báo port"}</span></> : id}</span>
          <button type="button" onClick={() => onChange(ids.filter((value) => value !== id))} className="shrink-0 px-2 py-1 text-danger" aria-label={`Gỡ phụ thuộc ${item?.name ?? id}`}>Gỡ</button>
        </li>;
      })}
    </ul>
    {!ids.length && <p className="mt-4 text-sm text-muted">Chưa chọn dịch vụ phụ thuộc.</p>}
    <label htmlFor="dependency-search" className="mt-5 mb-2 block text-sm font-medium">Tìm theo tên dịch vụ</label>
    <input id="dependency-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className={inputClass} placeholder="PostgreSQL, Redis…" />
    {loading ? <p role="status" className="mt-3 text-sm text-muted">Đang tải…</p> : error ? <div role="alert" className="mt-3 text-sm text-danger">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="underline">Thử lại</button></div> : <>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-surface-raised">
          <input type="checkbox" checked={ids.includes(item.id)} disabled={!ids.includes(item.id) && ids.length >= 100} onChange={(event) => onChange(event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />
          <span className="min-w-0 text-sm"><span className="font-medium">{item.name}</span><span className="ml-2 text-muted">{item.server_name} · {item.server_ip}</span><span className="mt-1 block break-words text-xs text-muted">Port: {item.ports.length ? item.ports.map((port) => `${port.name}: ${port.port}/${port.protocol}`).join(", ") : "Chưa khai báo port"}</span></span>
        </label>)}
        {!items.length && <p className="text-sm text-muted">Không tìm thấy dịch vụ có thể chọn.</p>}
      </div>
      {total > 20 && <div className="mt-3 flex items-center gap-3 text-sm">
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Trước</button>
        <span>Trang {page}/{Math.ceil(total / 20)}</span>
        <button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Sau</button>
      </div>}
    </>}
  </section>;
}
