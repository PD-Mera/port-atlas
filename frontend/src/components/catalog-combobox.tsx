"use client";

import { useEffect, useId, useState } from "react";

import type { CatalogItem, Page } from "@/lib/types";

import { inputClass } from "./ui";

type CatalogLoader = (options: { page?: number; q?: string; signal?: AbortSignal }) => Promise<Page<CatalogItem>>;

export function CatalogCombobox({
  id,
  value,
  placeholder,
  loadOptions,
  onChange,
  onCreate,
  onBusyChange,
  error,
}: {
  id?: string;
  value: string | null;
  placeholder: string;
  loadOptions: CatalogLoader;
  onChange: (value: string | null) => void;
  onCreate?: (value: string) => string | Promise<string>;
  onBusyChange?: (busy: boolean) => void;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-options`;
  const [draft, setDraft] = useState(value ?? "");
  const [options, setOptions] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await loadOptions({ q: draft.trim(), page: 1, signal: controller.signal });
        if (!controller.signal.aborted) setOptions(result.items);
      } catch (caught) {
        if (!controller.signal.aborted) setLoadError(caught instanceof Error ? caught.message : "Không tải được danh sách lựa chọn");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [draft, loadOptions, open]);

  const normalizedDraft = draft.trim();
  const hasExactOption = options.some((option) => option.value.toLowerCase() === normalizedDraft.toLowerCase());

  const choose = (next: string) => {
    setDraft(next);
    onChange(next || null);
    setOpen(false);
  };

  const create = async () => {
    if (!normalizedDraft || creating) return;
    setCreating(true);
    onBusyChange?.(true);
    setLoadError(null);
    try {
      const created = onCreate ? await onCreate(normalizedDraft) : normalizedDraft;
      choose(created);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Không tạo được lựa chọn mới");
    } finally {
      setCreating(false);
      onBusyChange?.(false);
    }
  };

  return <div className="relative">
    <input
      id={inputId}
      value={draft}
      disabled={creating}
      placeholder={placeholder}
      className={inputClass}
      role="combobox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-autocomplete="list"
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onChange={(event) => { setDraft(event.target.value); onChange(event.target.value || null); setOpen(true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "Enter" && normalizedDraft && !hasExactOption) { event.preventDefault(); void create(); }
      }}
    />
    {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    {open && <div id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      {loading && <p className="px-3 py-2 text-sm text-slate-500">Đang tải…</p>}
      {!loading && options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value.toLowerCase() === normalizedDraft.toLowerCase()} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50">
        <span>{option.value}</span><span className="text-xs text-slate-400">{option.count}</span>
      </button>)}
      {!loading && normalizedDraft && !hasExactOption && <button type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => void create()} className="mt-1 flex w-full items-center rounded-md border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50">
        {creating ? "Đang tạo…" : `+ Tạo mới “${normalizedDraft}”`}
      </button>}
      {!loading && !options.length && !normalizedDraft && <p className="px-3 py-2 text-sm text-slate-500">Chưa có lựa chọn.</p>}
      {loadError && <p role="alert" className="px-3 py-2 text-sm text-red-700">{loadError}</p>}
    </div>}
  </div>;
}
