import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type FieldElementProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function FormField({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: ReactNode;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const field = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldElementProps>, {
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {field}
      {hint && <p id={`${id}-hint`} className="text-sm text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
