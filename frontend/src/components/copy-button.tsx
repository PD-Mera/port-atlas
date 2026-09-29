"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Sao chép" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1400);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 1800);
    }
  };
  return <button type="button" onClick={copy} title={value} className={`rounded-md border px-2 py-1 text-xs transition ${state === "failed" ? "border-danger/25 text-danger" : "border-border text-muted hover:border-accent/50 hover:text-accent"}`}>{state === "copied" ? "Đã sao chép" : state === "failed" ? "Không copy được" : label}</button>;
}
