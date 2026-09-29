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
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
    {items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id}>
      <Link href={`/services/${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 hover:bg-blue-50">
        <span className="min-w-0"><span className="font-medium text-blue-700">{item.name}</span><span className="ml-2 text-sm text-slate-500">{item.server_name} · {item.server_ip}</span><span className="mt-1 block break-words text-xs text-slate-500">Port: {portText(item)}</span></span>
        <StatusBadge status={item.status} />
      </Link>
    </li>)}</ul> : <p className="text-sm text-slate-500">{emptyMessage}</p>}
  </div>;
}
