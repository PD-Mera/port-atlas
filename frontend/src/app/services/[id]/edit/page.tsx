"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getService } from "@/lib/api";
import type { Service } from "@/lib/types";

import { ServiceForm } from "@/components/service-form";
import { ErrorState, LoadingState } from "@/components/ui";

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); getService(params.id, controller.signal).then(setService).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được service"); }); return () => controller.abort(); }, [params.id]);
  if (error) return <ErrorState message={error} />;
  if (!service) return <LoadingState label="Đang tải service…" />;
  return <ServiceForm service={service} title={`Sửa ${service.name}`} />;
}
