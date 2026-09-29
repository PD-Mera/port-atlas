"use client";

import { useEffect, useId, useState } from "react";

import { ApiError, deleteServiceType, listServiceTypes, saveServiceType } from "@/lib/api";
import type { CatalogItem } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, inputClass } from "@/components/ui";

export default function ServiceTypesPage() {
  const inputId = useId();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result = await listServiceTypes({ q: query, page, signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(result.items);
        setTotal(result.total);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Không tải được service type");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [page, query, refresh]);

  const add = async () => {
    const value = draft.trim().toLowerCase();
    if (!value || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveServiceType(value);
      setDraft("");
      setPage(1);
      setRefresh((current) => current + 1);
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.body.message : caught instanceof Error ? caught.message : "Không thêm được service type");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: CatalogItem) => {
    if (item.count > 0 || deleting) return;
    if (!window.confirm(`Xoá service type “${item.value}”?`)) return;
    setDeleting(item.value);
    setError(null);
    try {
      await deleteServiceType(item.value);
      setRefresh((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.body.message : caught instanceof Error ? caught.message : "Không xoá được service type");
    } finally {
      setDeleting(null);
    }
  };

  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return <div className="space-y-8">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">Quản trị</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Service types</h1>
      <p className="mt-2 text-muted">Quản lý các loại dịch vụ dùng trong form. Loại đang được service sử dụng không thể xoá.</p>
    </div>

    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <h2 className="text-lg font-semibold">Thêm service type</h2>
      <p className="mt-1 text-sm text-muted">Tên sẽ được trim và chuẩn hoá về chữ thường.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">Tên service type mới</label>
        <input id={inputId} maxLength={100} value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} className={inputClass} placeholder="fastapi, worker, tritonserver…" />
        <button type="button" disabled={saving || !draft.trim()} onClick={() => void add()} className="rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{saving ? "Đang lưu…" : "Thêm"}</button>
      </div>
      {formError && <p role="alert" className="mt-3 text-sm text-danger">{formError}</p>}
    </section>

    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h2 className="text-lg font-semibold">Danh sách service type</h2><p className="text-sm text-muted">{total} loại, cột đang dùng là số service đang gắn loại đó.</p></div>
        <input aria-label="Tìm service type" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className={`${inputClass} sm:max-w-xs`} placeholder="Tìm service type…" />
      </div>
      {error && <ErrorState message={error} />}
      {loading ? <LoadingState /> : items.length ? <div className="overflow-hidden rounded-2xl border border-border bg-surface"><div className="divide-y divide-border">{items.map((item) => <div key={item.value} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="font-medium text-foreground">{item.value}</p><p className="mt-1 text-sm text-muted">{item.count} service đang sử dụng</p></div><button type="button" disabled={item.count > 0 || deleting === item.value || deleting !== null} onClick={() => void remove(item)} title={item.count > 0 ? "Không thể xoá loại đang được sử dụng" : "Xoá service type"} className="rounded-lg border border-danger/25 px-3 py-2 text-sm text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40">{deleting === item.value ? "Đang xoá…" : "Xoá"}</button></div>)}</div></div> : <EmptyState title="Chưa có service type phù hợp" />}
      {!loading && total > pageSize && <div className="flex items-center justify-center gap-3 text-sm"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Trước</button><span>Trang {page}/{pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Sau</button></div>}
    </section>
  </div>;
}
