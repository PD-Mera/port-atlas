"use client";

import { listServiceTypes, saveServiceType } from "@/lib/api";
import { CatalogCombobox } from "./catalog-combobox";

export function ServiceTypePicker({ value, onChange, onBusyChange }: {
  value: string | null;
  onChange: (value: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  return <CatalogCombobox
    id="service-type"
    value={value}
    placeholder="Gõ hoặc chọn service type…"
    loadOptions={listServiceTypes}
    onChange={(next) => onChange(next?.trim().toLowerCase() || null)}
    onCreate={async (next) => (await saveServiceType(next.toLowerCase())).value}
    onBusyChange={onBusyChange}
  />;
}
