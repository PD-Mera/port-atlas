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
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">PortAtlas</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Tìm đúng service trong vài giây.</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">Tra cứu server, IP, port, endpoint, Docker container và lệnh vận hành từ một ô tìm kiếm.</p>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-7">
        <SearchField id="global-search" value={query} onValueChange={setQuery} label="Tìm toàn registry" autoComplete="off" />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Ví dụ:</span>{examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)} className="rounded-md bg-white px-2 py-1 text-blue-700 shadow-sm hover:bg-blue-100">{example}</button>)}</div>
        {data?.filters && data.filters.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{data.filters.map((filter, index) => <span key={`${filter.key}-${filter.value}-${index}`} className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">{filter.key}: {filter.value}</span>)}</div>}
      </section>

      {loading && <LoadingState label="Đang tìm trong registry…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && hasQuery && (
        <section>
          <SectionHeading title={`${data?.total ?? 0} kết quả`} action={<Link href="/services/new" className="text-sm font-medium text-blue-700 hover:underline">Thêm service</Link>} />
          {data?.items.length ? <div className="grid gap-4 md:grid-cols-2">{data.items.map((service) => <ServiceCard key={service.id} service={service} score={service.score} />)}</div> : <EmptyState title="Không tìm thấy service phù hợp">Thử tên không đầy đủ, IP suffix, port hoặc một tag khác.</EmptyState>}
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
