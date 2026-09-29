"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CopyButton } from "./copy-button";
import { StatusBadge } from "./ui";
import type { Command, Endpoint, Service } from "@/lib/types";

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
  return <div className="flex min-w-0 items-center gap-2">{href ? <a href={href} target="_blank" rel="noreferrer noopener" className="min-w-0 truncate text-sm text-blue-700 hover:underline">{endpoint.name}<span className="ml-2 text-xs text-slate-400">{endpoint.url}</span></a> : <span className="min-w-0 truncate text-sm text-slate-500">{endpoint.name}<span className="ml-2 text-xs">URL không hợp lệ: {endpoint.url}</span></span>}<CopyButton value={endpoint.url} label="Copy URL" /></div>;
}

function CommandRow({ command }: { command: Command }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-slate-800">{command.name} <span className="font-normal text-slate-400">· {command.command_type}</span></p><code className="mt-1 block max-w-full overflow-x-auto whitespace-pre text-xs text-slate-600">{command.command}</code></div><CopyButton value={command.command} /></div>;
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
  return <div className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-slate-950">{service.name}</h1><StatusBadge status={service.status} /></div><p className="mt-2 text-slate-600"><Link href={`/servers/${service.server.id}`} className="text-blue-700 hover:underline">{service.server.name}</Link> · {service.server.ip}{service.project ? ` · ${service.project}` : ""}</p></div><div className="flex gap-2"><Link href={`/services/${service.id}/edit`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Sửa</Link><button type="button" disabled={deleting} onClick={deleteCurrent} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">{deleting ? "Đang xoá…" : "Xoá"}</button></div></div>{deleteError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p>}{service.description && <p className="max-w-3xl text-lg leading-8 text-slate-600">{service.description}</p>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Server</p><p className="mt-2 font-semibold">{service.server.name}</p><div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><span>{service.server.ip}</span><CopyButton value={service.server.ip} label="Copy IP" /></div></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Container</p><p className="mt-2 break-words font-semibold">{service.container_name || "—"}</p><p className="mt-2 break-words text-sm text-slate-600">{service.docker_image || "Chưa khai báo image"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Environment</p><p className="mt-2 font-semibold">{service.environment || "—"}</p><p className="mt-2 text-sm text-slate-600">Owner: {service.owner || "—"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Truy cập</p><p className="mt-2 font-semibold">{service.access_count} lần</p><p className="mt-2 text-sm text-slate-600">{service.last_accessed_at ? new Date(service.last_accessed_at).toLocaleString("vi-VN") : "Chưa mở"}</p></div></section>
    <section className="grid gap-8 lg:grid-cols-2"><div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><div><h2 className="mb-3 text-lg font-semibold">Ports</h2>{service.ports.length ? <div className="space-y-2">{service.ports.map((port) => <div key={port.id ?? `${port.name}-${port.port}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span className="text-sm"><strong>{port.name}</strong> <span className="text-slate-500">{port.port}/{port.protocol}</span></span><CopyButton value={port.protocol === "http" || port.protocol === "https" ? copyUrl(port.port, port.protocol) : `${service.server.ip}:${port.port}`} label="Copy" /></div>)}</div> : <p className="text-sm text-slate-500">Chưa khai báo port.</p>}</div><div><h2 className="mb-3 text-lg font-semibold">Aliases & tags</h2><div className="flex flex-wrap gap-2">{service.aliases.map((alias) => <span key={alias} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{alias}</span>)}{service.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">#{tag}</span>)}{!service.aliases.length && !service.tags.length && <span className="text-sm text-slate-500">Chưa khai báo.</span>}</div></div></div><div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><div><h2 className="mb-3 text-lg font-semibold">Endpoints</h2>{endpoints.length ? <div className="space-y-2">{endpoints.map((endpoint) => <div key={endpoint.id ?? endpoint.url} className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs uppercase tracking-wider text-slate-400">{endpoint.endpoint_type}</span><ExternalLink endpoint={endpoint} /></div>)}</div> : <p className="text-sm text-slate-500">Chưa khai báo endpoint.</p>}</div><div><h2 className="mb-3 text-lg font-semibold">Quick actions</h2><div className="flex flex-wrap gap-2">{ssh && <CopyButton value={ssh} label="Copy SSH" />}{service.compose_path && <CopyButton value={service.compose_path} label="Copy Compose path" />}{service.working_directory && <CopyButton value={service.working_directory} label="Copy workdir" />}</div></div></div></section>
    <section className="grid gap-8 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="mb-3 text-lg font-semibold">Commands</h2>{service.commands.length ? <div className="space-y-3">{service.commands.map((command) => <CommandRow key={command.id ?? command.name} command={command} />)}</div> : <p className="text-sm text-slate-500">Chưa khai báo command.</p>}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="mb-3 text-lg font-semibold">Ghi chú</h2><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{service.notes || "Chưa có ghi chú."}</p><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Service type</dt><dd className="break-all text-right">{service.service_type || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Compose</dt><dd className="break-all text-right">{service.compose_path || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Working directory</dt><dd className="break-all text-right">{service.working_directory || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Tạo lúc</dt><dd className="text-right">{new Date(service.created_at).toLocaleString("vi-VN")}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Cập nhật</dt><dd className="text-right">{new Date(service.updated_at).toLocaleString("vi-VN")}</dd></div></dl></div></section>
  </div>;
}
