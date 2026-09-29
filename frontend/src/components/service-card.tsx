import Link from "next/link";

import type { ServiceSummary } from "@/lib/types";

import { StatusBadge } from "./ui";

export function ServiceCard({ service, score }: { service: ServiceSummary; score?: number }) {
  return (
    <Link href={`/services/${service.id}`} className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{service.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{service.server_name} · {service.server_ip}</p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge status={service.status} />{score !== undefined && <span className="text-xs text-slate-400">{Math.round(score)} pts</span>}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {service.project && <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">{service.project}</span>}
        {service.environment && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{service.environment}</span>}
        {service.container_name && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{service.container_name}</span>}
        {service.tags.map((tag) => <span key={tag} className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">#{tag}</span>)}
      </div>
      {service.ports.length > 0 && <p className="mt-4 text-sm text-slate-600">{service.ports.map((port) => `${port.name}: ${port.port}/${port.protocol}`).join(" · ")}</p>}
      {service.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{service.description}</p>}
    </Link>
  );
}
