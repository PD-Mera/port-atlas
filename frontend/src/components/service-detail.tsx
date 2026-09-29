"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CopyButton } from "./copy-button";
import { StatusBadge } from "./ui";
import type { Command, Endpoint, Service } from "@/lib/types";
import { DependencyList } from "./dependency-list";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function defaultSshCommand(service: Service): string | null {
  const host = service.server.hostname || service.server.ip;
  if (!service.server.ssh_user) return null;
  return `ssh -p ${service.server.ssh_port} ${shellQuote(`${service.server.ssh_user}@${host}`)}`;
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function ExternalLink({ endpoint }: { endpoint: Endpoint }) {
  const href = safeHttpUrl(endpoint.url);
  return <div className="flex min-w-0 items-center gap-2">{href ? <a href={href} target="_blank" rel="noreferrer noopener" className="min-w-0 truncate text-sm text-accent hover:underline">{endpoint.name}<span className="ml-2 text-xs text-subtle">{endpoint.url}</span></a> : <span className="min-w-0 truncate text-sm text-muted">{endpoint.name}<span className="ml-2 text-xs">URL không hợp lệ: {endpoint.url}</span></span>}<CopyButton value={endpoint.url} label="Copy URL" /></div>;
}

function CommandRow({ command }: { command: Command }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{command.name} <span className="font-normal text-subtle">· {command.command_type}</span></p><code className="mt-1 block max-w-full overflow-x-auto whitespace-pre text-xs text-muted">{command.command}</code></div><CopyButton value={command.command} /></div>;
}

export function ServiceDetail({ service, onDelete }: { service: Service; onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ssh = useMemo(() => defaultSshCommand(service), [service]);
  const declaredEndpoints: Endpoint[] = [];
  if (service.healthcheck_url) {
    declaredEndpoints.push({ id: "healthcheck", name: "Healthcheck", url: service.healthcheck_url, endpoint_type: "healthcheck" });
  }
  if (service.swagger_url) {
    declaredEndpoints.push({ id: "swagger", name: "Swagger", url: service.swagger_url, endpoint_type: "swagger" });
  }
  if (service.management_url) {
    declaredEndpoints.push({ id: "management", name: "Management", url: service.management_url, endpoint_type: "management" });
  }
  const endpoints = [...service.endpoints, ...declaredEndpoints];
  const copyUrl = (port: number, protocol: string) => `${protocol === "https" ? "https" : "http"}://${service.server.ip}:${port}`;
  const deleteCurrent = async () => {
    if (!window.confirm(`Xoá service “${service.name}”?`)) return;
    setDeleting(true);
    setDeleteError(null);
    try { await onDelete(); }
    catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Không thể xoá service"); }
    finally { setDeleting(false); }
  };
  return <div className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-foreground">{service.name}</h1><StatusBadge status={service.status} /></div><p className="mt-2 text-muted"><Link href={`/servers/${service.server.id}`} className="text-accent hover:underline">{service.server.name}</Link> · {service.server.ip}{service.project ? ` · ${service.project}` : ""}</p></div><div className="flex gap-2"><Link href={`/services/${service.id}/edit`} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-raised">Sửa</Link><button type="button" disabled={deleting} onClick={deleteCurrent} className="rounded-lg border border-danger/25 px-4 py-2 text-sm text-danger hover:bg-danger-soft disabled:opacity-50">{deleting ? "Đang xoá…" : "Xoá"}</button></div></div>{deleteError && <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">{deleteError}</p>}{service.description && <p className="max-w-3xl text-lg leading-8 text-muted">{service.description}</p>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Server</p><p className="mt-2 font-semibold">{service.server.name}</p><div className="mt-2 flex items-center gap-2 text-sm text-muted"><span>{service.server.ip}</span><CopyButton value={service.server.ip} label="Copy IP" /></div></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Run Command</p><code className="mt-2 block max-h-20 overflow-auto break-words text-xs text-foreground">{service.run_command || "Chưa khai báo"}</code></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Komodo Path</p><p className="mt-2 break-words font-mono text-sm">{service.komodo_path || "—"}</p><p className="mt-2 text-xs text-muted">Owner: {service.owner || "—"}</p></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Truy cập</p><p className="mt-2 font-semibold">{service.access_count} lần</p><p className="mt-2 text-sm text-muted">{service.last_accessed_at ? new Date(service.last_accessed_at).toLocaleString("vi-VN") : "Chưa mở"}</p></div></section>
    <section className="grid gap-8 lg:grid-cols-2"><div className="space-y-6 rounded-2xl border border-border bg-surface p-5 sm:p-7"><div><h2 className="mb-3 text-lg font-semibold">Ports</h2>{service.ports.length ? <div className="space-y-2">{service.ports.map((port) => <div key={port.id ?? `${port.name}-${port.port}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2"><span className="text-sm"><strong>{port.name}</strong> <span className="text-muted">{port.port}/{port.protocol}</span></span><CopyButton value={port.protocol === "http" || port.protocol === "https" ? copyUrl(port.port, port.protocol) : `${service.server.ip}:${port.port}`} label="Copy" /></div>)}</div> : <p className="text-sm text-muted">Chưa khai báo port.</p>}</div><div><h2 className="mb-3 text-lg font-semibold">Aliases & tags</h2><div className="flex flex-wrap gap-2">{service.aliases.map((alias) => <span key={alias} className="rounded-full bg-surface-raised px-3 py-1 text-sm text-foreground">{alias}</span>)}{service.tags.map((tag) => <span key={tag} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">#{tag}</span>)}{!service.aliases.length && !service.tags.length && <span className="text-sm text-muted">Chưa khai báo.</span>}</div></div></div><div className="space-y-6 rounded-2xl border border-border bg-surface p-5 sm:p-7"><div><h2 className="mb-3 text-lg font-semibold">Endpoints</h2>{endpoints.length ? <div className="space-y-2">{endpoints.map((endpoint) => <div key={endpoint.id ?? endpoint.url} className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs uppercase tracking-wider text-subtle">{endpoint.endpoint_type}</span><ExternalLink endpoint={endpoint} /></div>)}</div> : <p className="text-sm text-muted">Chưa khai báo endpoint.</p>}</div><div><h2 className="mb-3 text-lg font-semibold">Quick actions</h2><div className="flex flex-wrap gap-2">{ssh && <CopyButton value={ssh} label="Copy SSH" />}{service.run_command && <CopyButton value={service.run_command} label="Copy Run Command" />}{service.komodo_path && <CopyButton value={service.komodo_path} label="Copy Komodo Path" />}{service.working_directory && <CopyButton value={service.working_directory} label="Copy workdir" />}</div></div></div></section>
    <section className="grid gap-8 lg:grid-cols-2"><div className="rounded-2xl border border-border bg-surface p-5 sm:p-7"><h2 className="mb-3 text-lg font-semibold">Commands</h2>{service.commands.length ? <div className="space-y-3">{service.commands.map((command) => <CommandRow key={command.id ?? command.name} command={command} />)}</div> : <p className="text-sm text-muted">Chưa khai báo command.</p>}</div><div className="rounded-2xl border border-border bg-surface p-5 sm:p-7"><h2 className="mb-3 text-lg font-semibold">Ghi chú</h2><p className="whitespace-pre-wrap text-sm leading-7 text-muted">{service.notes || "Chưa có ghi chú."}</p><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Service type</dt><dd className="break-all text-right">{service.service_type || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Owner</dt><dd className="break-all text-right">{service.owner || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Working directory</dt><dd className="break-all text-right">{service.working_directory || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Tạo lúc</dt><dd className="text-right">{new Date(service.created_at).toLocaleString("vi-VN")}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Cập nhật</dt><dd className="text-right">{new Date(service.updated_at).toLocaleString("vi-VN")}</dd></div></dl></div></section>
    {service.service_type?.trim().toLowerCase() === "tritonserver" && <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <h2 className="mb-3 text-lg font-semibold">Triton model names</h2>
      {service.triton_model_names.length ? <ul className="flex flex-wrap gap-2">{service.triton_model_names.map((name) => <li key={name} className="flex items-center gap-2 rounded-lg bg-surface-raised px-3 py-2"><code className="break-all text-sm">{name}</code><CopyButton value={name} label="Copy" /></li>)}</ul> : <p className="text-sm text-muted">Chưa khai báo model.</p>}
    </section>}
    <section className="grid gap-8 lg:grid-cols-2">
      <DependencyList title="Phụ thuộc vào" items={service.dependencies} />
      <DependencyList title="Được phụ thuộc bởi" items={service.dependents} />
    </section>
  </div>;
}
