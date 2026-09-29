import Link from "next/link";
import type { ServiceReference } from "@/lib/types";
import { StatusBadge } from "./ui";

export function DependencyList({ title, items, description, emptyMessage = "Chưa có quan hệ phụ thuộc." }: {
  title: string;
  items: ServiceReference[];
  description?: string;
  emptyMessage?: string;
}) {
  const portText = (item: ServiceReference) => item.ports.length
    ? item.ports.map((port) => `${port.name}: ${port.port}/${port.protocol}`).join(", ")
    : "Chưa khai báo port";
  return <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    {description && <p className="mb-4 text-sm text-muted">{description}</p>}
    {items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id}>
      <Link href={`/services/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-raised p-3 hover:bg-accent-soft">
        <span className="min-w-0"><span className="font-medium text-accent">{item.name}</span><span className="ml-2 text-sm text-muted">{item.server_name} · {item.server_ip}</span><span className="mt-1 block break-words text-xs text-muted">Port: {portText(item)}</span></span>
        <StatusBadge status={item.status} />
      </Link>
    </li>)}</ul> : <p className="text-sm text-muted">{emptyMessage}</p>}
  </div>;
}
