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
  return <button type="button" onClick={copy} title={value} className={`rounded-md border px-2 py-1 text-xs transition ${state === "failed" ? "border-red-200 text-red-700" : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"}`}>{state === "copied" ? "Đã sao chép" : state === "failed" ? "Không copy được" : label}</button>;
}
