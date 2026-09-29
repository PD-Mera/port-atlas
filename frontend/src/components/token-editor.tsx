"use client";

import { useState } from "react";

import { inputClass } from "./ui";

export function TokenEditor({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const valuesToAdd = draft.split(",").map((value) => value.trim()).filter(Boolean);
    if (!valuesToAdd.length) return;
    const seen = new Set(values.map((value) => value.toLowerCase()));
    const next = [...values];
    for (const value of valuesToAdd) if (!seen.has(value.toLowerCase())) { seen.add(value.toLowerCase()); next.push(value); }
    onChange(next);
    setDraft("");
  };
  return <div className="space-y-2"><label className="block text-sm font-medium">{label}</label><div className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} className={inputClass} placeholder={placeholder} /><button type="button" onClick={add} className="rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">Thêm</button></div><div className="flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" title="Xoá" onClick={() => onChange(values.filter((item) => item !== value))} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-red-50 hover:text-red-700">{value} ×</button>)}</div></div>;
}
