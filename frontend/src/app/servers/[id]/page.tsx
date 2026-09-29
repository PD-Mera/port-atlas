"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ApiError, deleteServer, getServer } from "@/lib/api";
import type { ServerDetail } from "@/lib/types";

import { ServiceCard } from "@/components/service-card";
import { ErrorState, EmptyState, LoadingState } from "@/components/ui";

export default function ServerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [server, setServer] = useState<ServerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { const controller = new AbortController(); getServer(params.id, controller.signal).then(setServer).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được server"); }); return () => controller.abort(); }, [params.id]);
  if (error) return <ErrorState message={error} />;
  if (!server) return <LoadingState label="Đang tải server…" />;
  const remove = async () => {
    if (server.services.length || !window.confirm(`Xoá server “${server.name}”?`)) return;
    setDeleting(true); setError(null);
    try { await deleteServer(server.id); router.push("/servers"); }
    catch (caught) { setError(caught instanceof ApiError ? caught.body.message : caught instanceof Error ? caught.message : "Không thể xoá server"); setDeleting(false); }
  };
  return <div className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-accent">Server</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{server.name}</h1><p className="mt-2 text-muted">{server.hostname || server.ip} · {server.location || "Chưa khai báo location"}</p></div><div className="flex gap-2"><Link href={`/servers/${server.id}/edit`} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-raised">Sửa server</Link><button type="button" disabled={deleting || server.services.length > 0} onClick={remove} title={server.services.length ? "Xoá các service trước" : "Xoá server"} className="rounded-lg border border-danger/25 px-4 py-2 text-sm text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Đang xoá…" : "Xoá"}</button></div></div><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">IP</p><p className="mt-2 font-semibold">{server.ip}</p></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">SSH</p><p className="mt-2 font-semibold">{server.ssh_user || "—"}:{server.ssh_port}</p></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Services</p><p className="mt-2 font-semibold">{server.services.length}</p></div><div className="rounded-xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wider text-subtle">Tags</p><p className="mt-2 text-sm">{server.tags.join(", ") || "—"}</p></div></section><section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Services trên server</h2><Link href={`/services/new?server_id=${server.id}`} className="text-sm font-medium text-accent hover:underline">+ Thêm service</Link></div>{server.services.length ? <div className="grid gap-4 md:grid-cols-2">{server.services.map((service) => <ServiceCard key={service.id} service={service} />)}</div> : <EmptyState title="Chưa có service">Thêm service đầu tiên trên server này.</EmptyState>}</section></div>;
}
