"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listServers } from "@/lib/api";
import type { ServerListItem } from "@/lib/types";

import { EmptyState, ErrorState, LoadingState, SectionHeading } from "@/components/ui";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(null); listServers({ page_size: 100, q: query, signal: controller.signal }).then((result) => setServers(result.items)).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được server"); }).finally(() => setLoading(false)); return () => controller.abort(); }, [query]);
  return <div className="space-y-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Infrastructure</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Servers</h1><p className="mt-2 text-slate-600">Các server và số service đang được quản lý.</p></div><Link href="/servers/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Thêm server</Link></div><input aria-label="Lọc server" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Lọc theo tên, hostname hoặc IP…" className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />{error && <ErrorState message={error} />}{loading ? <LoadingState /> : servers.length ? <div className="grid gap-4 md:grid-cols-2">{servers.map((server) => <Link key={server.id} href={`/servers/${server.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{server.name}</h2><p className="mt-1 text-sm text-slate-500">{server.hostname || server.ip}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{server.service_count} service</span></div><p className="mt-4 text-sm text-slate-600">SSH: {server.ssh_user || "—"}@{server.ip}:{server.ssh_port}</p><div className="mt-3 flex flex-wrap gap-2">{server.tags.map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">#{tag}</span>)}</div></Link>)}</div> : <EmptyState title="Chưa có server">Thêm server đầu tiên để bắt đầu tạo service.</EmptyState>}<SectionHeading title="Gợi ý" /><p className="text-sm text-slate-500">Server không thể xoá khi vẫn còn service liên kết.</p></div>;
}
