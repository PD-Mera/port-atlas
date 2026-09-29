"use client";

import { useId, type InputHTMLAttributes } from "react";
import { Icon } from "./icon";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string; onValueChange: (value: string) => void; label?: string;
};

export function SearchField({ value, onValueChange, label = "Tìm service", id, ...props }: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-xs font-medium text-muted">{label}</label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" width="20" height="20" />
        <input {...props} id={inputId} type="search" value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={props.placeholder ?? "Tên service, model, IP, port, project hoặc tag…"}
          className={`w-full rounded-xl border border-border bg-background/70 py-4 pl-12 pr-4 text-base text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${props.className ?? ""}`}
        />
      </div>
    </div>
  );
}
