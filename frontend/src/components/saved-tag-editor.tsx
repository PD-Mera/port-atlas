"use client";

import { useEffect, useId, useRef, useState } from "react";
import { listSavedTags, saveTags } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";
import { TokenEditor } from "./token-editor";
import { inputClass } from "./ui";

export function SavedTagEditor({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const currentValues = useRef(values);
  currentValues.current = values;
  const selected = new Set(values.map((value) => value.toLowerCase()));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await listSavedTags({ q: query, page, signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Không tải được tag đã lưu");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page, revision]);

  const remember = async (tags: string[]) => {
    const stored = await saveTags(tags);
    setRevision((value) => value + 1);
    return stored;
  };

  return <div className="space-y-4">
    <TokenEditor label={label} values={values} onChange={(next) => {
      // Preserve any tags selected while the save request was in flight.
      const removed = values.filter((value) => !next.includes(value));
      const merged = [...currentValues.current.filter((value) => !removed.includes(value))];
      const seen = new Set(merged.map((value) => value.toLowerCase()));
      for (const value of next) if (!seen.has(value.toLowerCase())) { seen.add(value.toLowerCase()); merged.push(value); }
      onChange(merged);
    }} placeholder={placeholder} onAdd={remember} />
    <p className="text-xs text-slate-500">Tag mới được lưu vào danh sách dùng chung khi bấm Thêm. Bấm tag đã lưu để sử dụng lại.</p>
    <label htmlFor={searchId} className="block text-sm font-medium">Tag đã lưu</label>
    <input id={searchId} maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className={inputClass} placeholder="Tìm tag đã lưu…" />
    {loading ? <p role="status" className="text-sm text-slate-500">Đang tải tag…</p> : error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Thử lại</button></p> : <>
      <div className="flex flex-wrap gap-2">{items.map((item) => <button key={item.value} type="button" aria-pressed={selected.has(item.value.toLowerCase())} disabled={selected.has(item.value.toLowerCase()) || values.length >= 100} onClick={() => onChange([...values, item.value])} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:bg-blue-50 disabled:text-blue-700">
        #{item.value}{selected.has(item.value.toLowerCase()) ? " ✓" : " +"}
      </button>)}</div>
      {!items.length && <p className="text-sm text-slate-500">Chưa có tag phù hợp. Nhập tag mới ở trên để lưu.</p>}
      {total > 20 && <div className="flex items-center gap-3 text-sm">
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Trước</button>
        <span>{page}/{Math.ceil(total / 20)}</span>
        <button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Sau</button>
      </div>}
    </>}
  </div>;
}
