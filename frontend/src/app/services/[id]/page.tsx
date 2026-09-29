"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { deleteService, getService, recordServiceAccess } from "@/lib/api";
import type { Service } from "@/lib/types";

import { ServiceDetail } from "@/components/service-detail";
import { ErrorState, LoadingState } from "@/components/ui";

export default function ServiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessRecordedFor = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getService(params.id, controller.signal).then((result) => {
      setService(result);
      if (accessRecordedFor.current === params.id) return;
      accessRecordedFor.current = params.id;
      void recordServiceAccess(params.id)
        .then((access) => setService((current) => current ? { ...current, last_accessed_at: access.last_accessed_at, access_count: access.access_count } : current))
        .catch(() => undefined);
    }).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được service"); });
    return () => controller.abort();
  }, [params.id]);
  if (error) return <div className="space-y-4"><Link href="/" className="text-sm text-accent hover:underline">← Về tìm kiếm</Link><ErrorState message={error} /></div>;
  if (!service) return <LoadingState label="Đang tải thông tin service…" />;
  return <ServiceDetail service={service} onDelete={async () => { await deleteService(service.id); router.push("/"); }} />;
}
