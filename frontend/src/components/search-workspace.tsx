"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useRegistrySearch } from "@/hooks/use-registry-search";

import { SearchField } from "./search-field";
import { ServiceCard } from "./service-card";
import { EmptyState, ErrorState, LoadingState, SectionHeading } from "./ui";

const examples = ["241 s2t", "236 triton yolor", "4067", "tag:gpu", "project:s2t port:4067"];

export function SearchWorkspace() {
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQuery(initial);
    setReady(true);
  }, []);
  const { data, loading, error } = useRegistrySearch(query, ready);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted"><span className="size-1.5 rounded-full bg-accent" />Service registry</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Tìm đúng service. Trong vài giây.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Một nơi để tra cứu server, IP, port, Triton model, endpoint và lệnh vận hành.</p>
      </section>

      <section className="search-panel rounded-2xl border border-border p-5 sm:p-6">
        <SearchField id="global-search" value={query} onValueChange={setQuery} label="Tìm toàn registry" autoComplete="off" />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted"><span>Thử tìm:</span>{examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)} className="rounded-md border border-border bg-surface/80 px-2.5 py-1.5 font-mono text-muted transition hover:border-accent/50 hover:text-accent">{example}</button>)}</div>
        {data?.filters && data.filters.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{data.filters.map((filter, index) => <span key={`${filter.key}-${filter.value}-${index}`} className="rounded-full bg-accent-strong px-3 py-1 text-xs font-medium text-white">{filter.key}: {filter.value}</span>)}</div>}
      </section>

      {loading && <LoadingState label="Đang tìm trong registry…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && hasQuery && (
        <section>
          <SectionHeading title={`${data?.total ?? 0} kết quả`} action={<Link href="/services/new" className="text-sm font-medium text-accent hover:underline">Thêm service</Link>} />
          {data?.items.length ? <div className="grid gap-4 md:grid-cols-2">{data.items.map((service) => <ServiceCard key={service.id} service={service} score={service.score} />)}</div> : <EmptyState title="Không tìm thấy service phù hợp">Thử một phần tên, Triton model, IP, port hoặc tag khác.</EmptyState>}
        </section>
      )}
      {!loading && !error && !hasQuery && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section><SectionHeading title="Gần đây" />{data?.recent.length ? <div className="space-y-3">{data.recent.map((service) => <ServiceCard key={service.id} service={service} />)}</div> : <EmptyState title="Chưa có lịch sử truy cập">Mở một service để service xuất hiện ở đây.</EmptyState>}</section>
          <section><SectionHeading title="Thường dùng" />{data?.frequent.length ? <div className="space-y-3">{data.frequent.map((service) => <ServiceCard key={service.id} service={service} />)}</div> : <EmptyState title="Chưa có service thường dùng">Bộ đếm sẽ được cập nhật khi bạn mở chi tiết service.</EmptyState>}</section>
        </div>
      )}
    </div>
  );
}
