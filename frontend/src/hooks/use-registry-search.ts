"use client";

import { useEffect, useState } from "react";

import { searchRegistry } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";

export function useRegistrySearch(query: string, enabled = true) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        const result = await searchRegistry(query, controller.signal);
        if (active) setData(result);
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return;
        setError(caught instanceof Error ? caught.message : "Không thể tìm kiếm");
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, query]);

  return { data, loading, error };
}
