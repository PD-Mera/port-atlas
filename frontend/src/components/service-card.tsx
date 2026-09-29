import Link from "next/link";

import type { ServiceSummary } from "@/lib/types";

import { StatusBadge } from "./ui";
import { Icon } from "./icon";

export function ServiceCard({ service, score }: { service: ServiceSummary; score?: number }) {
  return (
    <Link href={`/services/${service.id}`} className="service-card group block min-w-0 rounded-xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:bg-surface-raised">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold text-foreground group-hover:text-accent">{service.name}</h3>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted"><Icon name="server" width="13" height="13" />{service.server_name}<span className="text-subtle">/</span><span className="font-mono">{service.server_ip}</span></p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge status={service.status} />{score !== undefined && <span className="sr-only">Điểm phù hợp: {Math.round(score)}</span>}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {service.project && <span className="rounded-md bg-accent-soft px-2 py-1 text-accent">{service.project}</span>}
        {service.service_type && <span className="rounded-md bg-surface-raised px-2 py-1 text-muted">{service.service_type}</span>}
        {service.tags.map((tag) => <span key={tag} className="rounded-md bg-accent-soft px-2 py-1 text-accent">#{tag}</span>)}
      </div>
      {service.ports.length > 0 && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">{service.ports.map((port) => <span key={port.id ?? `${port.name}-${port.port}-${port.protocol}`} className="rounded border border-border bg-background/40 px-2 py-1 text-xs"><span className="text-muted">{port.name} </span><span className="font-mono text-foreground">{port.port}</span><span className="text-subtle">/{port.protocol}</span></span>)}</div>}
      {service.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{service.description}</p>}
    </Link>
  );
}
