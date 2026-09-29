"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getServer } from "@/lib/api";
import type { Server } from "@/lib/types";

import { ServerForm } from "@/components/server-form";
import { ErrorState, LoadingState } from "@/components/ui";

export default function EditServerPage() {
  const params = useParams<{ id: string }>();
  const [server, setServer] = useState<Server | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); getServer(params.id, controller.signal).then(setServer).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được server"); }); return () => controller.abort(); }, [params.id]);
  if (error) return <ErrorState message={error} />;
  if (!server) return <LoadingState label="Đang tải server…" />;
  return <ServerForm server={server} title={`Sửa ${server.name}`} />;
}
