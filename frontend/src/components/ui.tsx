import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

export const textareaClass = `${inputClass} min-h-24 resize-y`;

export function StatusBadge({ status }: { status: string }) {
  const style = {
    running: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    stopped: "bg-slate-100 text-slate-600 ring-slate-200",
    degraded: "bg-amber-50 text-amber-700 ring-amber-200",
    unknown: "bg-blue-50 text-blue-700 ring-blue-200",
  }[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${style}`}>{status}</span>;
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-slate-900">{title}</h2>{action}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-semibold text-slate-800">{title}</p>{children && <p className="mt-2 text-sm text-slate-500">{children}</p>}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

export function LoadingState({ label = "Đang tải…" }: { label?: string }) {
  return <p role="status" className="py-8 text-center text-sm text-slate-500">{label}</p>;
}
