"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { ApiError, createServer, updateServer } from "@/lib/api";
import type { Server, ServerPayload } from "@/lib/types";

import { FormField } from "./form-field";
import { TokenEditor } from "./token-editor";
import { inputClass, textareaClass } from "./ui";

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function payloadFromServer(server?: Server): ServerPayload {
  return server ? {
    name: server.name, hostname: server.hostname, ip: server.ip, ssh_port: server.ssh_port,
    ssh_user: server.ssh_user, description: server.description, location: server.location, tags: [...server.tags],
  } : { name: "", hostname: null, ip: "", ssh_port: 22, ssh_user: null, description: null, location: null, tags: [] };
}

export function ServerForm({ server, title }: { server?: Server; title: string }) {
  const router = useRouter();
  const [form, setForm] = useState<ServerPayload>(() => payloadFromServer(server));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (server) setForm(payloadFromServer(server)); }, [server]);
  const set = <K extends keyof ServerPayload>(key: K, value: ServerPayload[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(null); setFieldErrors({});
    try {
      const payload: ServerPayload = {
        ...form,
        hostname: nullableText(form.hostname),
        ssh_user: nullableText(form.ssh_user),
        description: nullableText(form.description),
        location: nullableText(form.location),
      };
      const result = server ? await updateServer(server.id, payload) : await createServer(payload);
      router.push(`/servers/${result.id}`);
    }
    catch (caught) { if (caught instanceof ApiError) { setError(caught.body.message); setFieldErrors(Object.fromEntries(caught.body.details.map((detail) => [detail.field, detail.message]))); } else setError(caught instanceof Error ? caught.message : "Không thể lưu server"); }
    finally { setSaving(false); }
  };
  return <form onSubmit={save} className="space-y-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Infrastructure</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">Lưu thông tin kết nối và mô tả server.</p></div><div className="flex gap-2"><button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Huỷ</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu server"}</button></div></div>{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><div className="grid gap-5 md:grid-cols-2"><FormField id="server-name" label="Tên server" error={fieldErrors.name}><input id="server-name" required value={form.name} onChange={(event) => set("name", event.target.value)} className={inputClass} /></FormField><FormField id="server-ip" label="IP address" error={fieldErrors.ip}><input id="server-ip" required value={form.ip} onChange={(event) => set("ip", event.target.value)} className={inputClass} placeholder="10.9.3.241" /></FormField><FormField id="server-hostname" label="Hostname"><input id="server-hostname" value={form.hostname ?? ""} onChange={(event) => set("hostname", event.target.value)} className={inputClass} /></FormField><FormField id="server-location" label="Location"><input id="server-location" value={form.location ?? ""} onChange={(event) => set("location", event.target.value)} className={inputClass} placeholder="GPU room" /></FormField><FormField id="server-ssh-user" label="SSH user"><input id="server-ssh-user" value={form.ssh_user ?? ""} onChange={(event) => set("ssh_user", event.target.value)} className={inputClass} /></FormField><FormField id="server-ssh-port" label="SSH port" error={fieldErrors.ssh_port}><input id="server-ssh-port" required type="number" min={1} max={65535} value={form.ssh_port} onChange={(event) => set("ssh_port", Number(event.target.value))} className={inputClass} /></FormField><div className="md:col-span-2"><FormField id="server-description" label="Description"><textarea id="server-description" value={form.description ?? ""} onChange={(event) => set("description", event.target.value)} className={textareaClass} /></FormField></div><div className="md:col-span-2"><TokenEditor label="Tags" values={form.tags} onChange={(values) => set("tags", values)} placeholder="gpu, production" /></div></div></section></form>;
}
