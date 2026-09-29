"use client";

import { useEffect, useId, useState } from "react";
import { listServiceTypes, saveServiceType } from "@/lib/api";
import { inputClass } from "./ui";

export function ServiceTypePicker({ value, onChange, onBusyChange }: {
  value: string | null;
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const newTypeId = useId();
  const [types, setTypes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const selected = value?.trim().toLowerCase() ?? "";
  const options = Array.from(new Set([...types, ...(selected ? [selected] : [])])).sort();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    const load = async () => {
      try {
        const values: string[] = [];
        let page = 1;
        while (!controller.signal.aborted) {
          const result = await listServiceTypes({ page, signal: controller.signal });
          values.push(...result.items.map((item) => item.value));
          if (page * result.page_size >= result.total || !result.items.length) break;
          page += 1;
        }
        if (!controller.signal.aborted) setTypes((current) => Array.from(new Set([...current, ...values])));
      } catch (caught) {
        if (!controller.signal.aborted) setLoadError(caught instanceof Error ? caught.message : "Không tải được service type");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [retry]);

  const add = async () => {
    const next = draft.trim().toLowerCase();
    if (!next || adding) return;
    setAdding(true);
    onBusyChange(true);
    setAddError(null);
    try {
      const item = await saveServiceType(next);
      setTypes((current) => Array.from(new Set([...current, item.value])));
      onChange(item.value);
      setDraft("");
    } catch (caught) {
      setAddError(caught instanceof Error ? caught.message : "Không thêm được service type");
    } finally { setAdding(false); onBusyChange(false); }
  };

  return <div className="space-y-2">
    <select id="service-type" value={selected} disabled={adding} onChange={(event) => onChange(event.target.value || null)} className={inputClass}>
      <option value="">{loading ? "Đang tải loại dịch vụ…" : "Chưa chọn loại dịch vụ"}</option>
      {options.map((type) => <option key={type} value={type}>{type}</option>)}
    </select>
    {loadError && <p role="alert" className="text-sm text-red-700">{loadError} <button type="button" onClick={() => setRetry((current) => current + 1)} className="underline">Thử lại</button></p>}
    <label htmlFor={newTypeId} className="block text-xs text-slate-500">Thêm loại dịch vụ mới</label>
    <div className="flex gap-2">
      <input id={newTypeId} maxLength={100} value={draft} disabled={adding} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} className={inputClass} placeholder="Tên loại mới…" />
      <button type="button" disabled={adding || !draft.trim()} onClick={() => void add()} className="shrink-0 rounded-lg border px-3 text-sm disabled:opacity-50">{adding ? "Đang lưu…" : "+ Thêm"}</button>
    </div>
    {addError && <p role="alert" className="text-sm text-red-700">{addError}</p>}
  </div>;
}
