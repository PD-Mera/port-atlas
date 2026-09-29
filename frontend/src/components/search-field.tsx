"use client";

import { useId, type InputHTMLAttributes } from "react";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string; onValueChange: (value: string) => void; label?: string;
};

export function SearchField({ value, onValueChange, label = "Tìm service", id, ...props }: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">{label}</label>
      <input {...props} id={inputId} type="search" value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={props.placeholder ?? "Tên, IP, cổng, project hoặc tag…"}
        className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 ${props.className ?? ""}`}
      />
    </div>
  );
}
