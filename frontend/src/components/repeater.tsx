"use client";

import type { ReactNode } from "react";

export function Repeater({ label, children, onAdd, addLabel = "Thêm dòng" }: { label: string; children: ReactNode; onAdd: () => void; addLabel?: string }) {
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">{label}</h3><button type="button" onClick={onAdd} className="text-sm font-medium text-blue-700 hover:underline">+ {addLabel}</button></div>{children}</div>;
}
