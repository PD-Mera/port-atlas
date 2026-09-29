"use client";

import { useId, useState } from "react";

import { inputClass } from "./ui";

export function TokenEditor({ label, values, onChange, placeholder, onAdd }: {
  label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string;
  onAdd?: (values: string[]) => Promise<string[]>;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    if (saving) return;
    const valuesToAdd = draft.split(",").map((value) => value.trim()).filter(Boolean);
    if (!valuesToAdd.length) return;
    setSaving(true);
    setError(null);
    try {
      const added = onAdd ? await onAdd(valuesToAdd) : valuesToAdd;
      const seen = new Set(values.map((value) => value.toLowerCase()));
      const next = [...values];
      for (const value of added) if (!seen.has(value.toLowerCase())) { seen.add(value.toLowerCase()); next.push(value); }
      onChange(next);
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được tag");
    } finally { setSaving(false); }
  };
  return <div className="space-y-2">
    <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
    <div className="flex gap-2"><input id={inputId} disabled={saving} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} className={inputClass} placeholder={placeholder} /><button type="button" disabled={saving} onClick={() => void add()} className="rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{saving ? "Đang lưu…" : "Thêm"}</button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" disabled={saving} title="Xoá" onClick={() => onChange(values.filter((item) => item !== value))} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-red-50 hover:text-red-700">{value} ×</button>)}</div>
  </div>;
}
