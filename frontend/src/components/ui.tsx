import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-surface-raised";

export const textareaClass = `${inputClass} min-h-24 resize-y`;

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-success-soft text-success ring-success/25",
    stopped: "bg-surface-raised text-muted ring-border",
    degraded: "bg-warning-soft text-warning ring-warning/25",
    unknown: "bg-accent-soft text-accent ring-accent/30",
  };
  const style = styles[status] ?? "bg-surface-raised text-muted ring-border";
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium capitalize ring-1 ${style}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>;
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-foreground">{title}</h2>{action}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center"><span aria-hidden="true" className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-raised text-subtle">◇</span><p className="text-sm font-medium text-foreground">{title}</p>{children && <p className="mt-2 max-w-sm text-xs leading-6 text-muted">{children}</p>}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">{message}</div>;
}

export function LoadingState({ label = "Đang tải…" }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 py-8 text-sm text-muted"><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" />{label}</div>;
}
