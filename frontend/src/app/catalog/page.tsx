"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listCatalog } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";

import { EmptyState, ErrorState, LoadingState, SectionHeading } from "@/components/ui";

function filterLink(kind: "project" | "tag", value: string) {
  return `/?q=${encodeURIComponent(`${kind}:${value}`)}`;
}

export default function CatalogPage() {
  const [projects, setProjects] = useState<CatalogItem[]>([]);
  const [tags, setTags] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); setError(null); Promise.all([listCatalog("projects", controller.signal), listCatalog("tags", controller.signal)]).then(([projectPage, tagPage]) => { setProjects(projectPage.items); setTags(tagPage.items); }).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được catalog"); }).finally(() => setLoading(false)); return () => controller.abort(); }, []);
  return <div className="space-y-10"><div><p className="text-sm font-semibold uppercase tracking-wider text-accent">Catalog</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Projects & tags</h1><p className="mt-2 text-muted">Chọn một nhóm để lọc service trong global search.</p></div>{error && <ErrorState message={error} />}{loading ? <LoadingState /> : <div className="grid gap-8 lg:grid-cols-2"><section><SectionHeading title="Projects" />{projects.length ? <div className="grid gap-3 sm:grid-cols-2">{projects.map((item) => <Link key={item.value} href={filterLink("project", item.value)} className="rounded-xl border border-border bg-surface p-4 hover:border-accent/50 hover:shadow-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium">{item.value}</span><span className="text-sm text-muted">{item.count}</span></div></Link>)}</div> : <EmptyState title="Chưa có project" />}</section><section><SectionHeading title="Tags" />{tags.length ? <div className="flex flex-wrap gap-2">{tags.map((item) => <Link key={item.value} href={filterLink("tag", item.value)} className="rounded-full bg-accent-soft px-3 py-2 text-sm text-accent hover:bg-accent-soft">#{item.value} <span className="ml-1 text-muted">{item.count}</span></Link>)}</div> : <EmptyState title="Chưa có tag" />}</section></div>}</div>;
}
