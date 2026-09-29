"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

import { ApiError, createService, getService, listEnvironments, listProjects, listServers, updateService } from "@/lib/api";
import type { Command, Endpoint, Port, ServerListItem, Service, ServicePayload } from "@/lib/types";

import { FormField } from "./form-field";
import { DependencyPicker } from "./dependency-picker";
import { DependencyList } from "./dependency-list";
import { CatalogCombobox } from "./catalog-combobox";
import { Repeater } from "./repeater";
import { TokenEditor } from "./token-editor";
import { SavedTagEditor } from "./saved-tag-editor";
import { ServiceTypePicker } from "./service-type-picker";
import { inputClass, textareaClass } from "./ui";

const emptyPort = (): Omit<Port, "id"> => ({ name: "HTTP", port: 80, protocol: "http", description: "" });
const emptyEndpoint = (): Omit<Endpoint, "id"> => ({ name: "", url: "", endpoint_type: "endpoint" });
const emptyCommand = (): Omit<Command, "id"> => ({ name: "", command: "", command_type: "logs" });

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function payloadFromService(service: Service): ServicePayload {
  return {
    triton_model_names: [...service.triton_model_names],
    dependency_ids: service.dependencies.map((item) => item.id),
    server_id: service.server_id, name: service.name, description: service.description, project: service.project,
    environment: service.environment, service_type: service.service_type, status: service.status as ServicePayload["status"],
    container_name: service.container_name, docker_image: service.docker_image, compose_path: service.compose_path,
    working_directory: service.working_directory, healthcheck_url: service.healthcheck_url, swagger_url: service.swagger_url,
    management_url: service.management_url, owner: service.owner, notes: service.notes, aliases: [...service.aliases],
    tags: [...service.tags], ports: service.ports.map(({ id, ...port }) => port), commands: service.commands.map(({ id, ...command }) => command),
    endpoints: service.endpoints.map(({ id, ...endpoint }) => endpoint),
  };
}

function blankPayload(serverId = ""): ServicePayload {
  return { triton_model_names: [], dependency_ids: [], server_id: serverId, name: "", description: null, project: null, environment: null, service_type: null, status: "unknown", container_name: null, docker_image: null, working_directory: null, compose_path: null, healthcheck_url: null, swagger_url: null, management_url: null, owner: null, notes: null, aliases: [], tags: [], ports: [], commands: [], endpoints: [] };
}

export function ServiceForm({ service, title }: { service?: Service; title: string }) {
  const router = useRouter();
  const [form, setForm] = useState<ServicePayload>(() => service ? payloadFromService(service) : blankPayload());
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ServicePayload>(key: K, value: ServicePayload[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const controller = new AbortController();
    listServers({ page_size: 100, signal: controller.signal }).then((result) => setServers(result.items)).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Không tải được server"); }).finally(() => setLoadingServers(false));
    return () => controller.abort();
  }, []);

  useEffect(() => { if (service) setForm(payloadFromService(service)); }, [service]);
  useEffect(() => {
    if (service || form.server_id) return;
    const initialServer = new URLSearchParams(window.location.search).get("server_id");
    if (initialServer) set("server_id", initialServer);
  }, [service, form.server_id]);
  const selectedServer = useMemo(() => servers.find((server) => server.id === form.server_id), [servers, form.server_id]);
  const isTriton = form.service_type?.trim().toLowerCase() === "tritonserver";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingType) return;
    setSaving(true); setError(null); setFieldErrors({});
    try {
      const payload: ServicePayload = {
        ...form,
        description: nullableText(form.description),
        project: nullableText(form.project),
        environment: nullableText(form.environment),
        service_type: nullableText(form.service_type)?.toLowerCase() ?? null,
        triton_model_names: isTriton ? Array.from(new Set(form.triton_model_names.map((name) => name.trim()).filter(Boolean))) : [],
        container_name: nullableText(form.container_name),
        docker_image: nullableText(form.docker_image),
        compose_path: nullableText(form.compose_path),
        working_directory: nullableText(form.working_directory),
        healthcheck_url: nullableText(form.healthcheck_url),
        swagger_url: nullableText(form.swagger_url),
        management_url: nullableText(form.management_url),
        owner: nullableText(form.owner),
        notes: nullableText(form.notes),
        commands: form.commands.filter((command) => command.name.trim() || command.command.trim()),
        endpoints: form.endpoints.filter((endpoint) => endpoint.name.trim() || endpoint.url.trim()),
      };
      const result = service ? await updateService(service.id, payload) : await createService(payload);
      router.push(`/services/${result.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) { setError(caught.body.message); setFieldErrors(Object.fromEntries(caught.body.details.map((detail) => [detail.field, detail.message]))); }
      else setError(caught instanceof Error ? caught.message : "Không thể lưu service");
    } finally { setSaving(false); }
  };

  const updatePort = (index: number, value: Partial<Omit<Port, "id">>) => set("ports", form.ports.map((port, current) => current === index ? { ...port, ...value } : port));
  const updateEndpoint = (index: number, value: Partial<Omit<Endpoint, "id">>) => set("endpoints", form.endpoints.map((endpoint, current) => current === index ? { ...endpoint, ...value } : endpoint));
  const updateCommand = (index: number, value: Partial<Omit<Command, "id">>) => set("commands", form.commands.map((command, current) => current === index ? { ...command, ...value } : command));

  return <form onSubmit={save} className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Registry</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">Các trường có thể để trống nếu chưa biết; command chỉ được lưu để sao chép.</p></div><div className="flex gap-2"><button type="button" onClick={() => router.back()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Huỷ</button><button type="submit" disabled={saving || loadingServers || savingType} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu service"}</button></div></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {service && <DependencyList
      title={`Được phụ thuộc bởi (${service.dependents.length})`}
      items={service.dependents}
      description={service.dependents.length ? "Các dịch vụ dưới đây đang phụ thuộc vào dịch vụ này. Để gỡ quan hệ, sửa mục Phụ thuộc vào trên dịch vụ tương ứng." : undefined}
      emptyMessage="Chưa có dịch vụ khác phụ thuộc vào dịch vụ này."
    />}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="mb-5 text-lg font-semibold">Thông tin chính</h2><div className="grid gap-5 md:grid-cols-2">
      <FormField id="service-name" label="Tên service" error={fieldErrors.name}><input id="service-name" required value={form.name} onChange={(event) => set("name", event.target.value)} className={inputClass} /></FormField>
      <FormField id="service-server" label="Server" error={fieldErrors.server_id}><select id="service-server" required value={form.server_id} onChange={(event) => set("server_id", event.target.value)} className={inputClass}><option value="">{loadingServers ? "Đang tải server…" : "Chọn server"}</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name} · {server.ip}</option>)}</select>{selectedServer && <p className="mt-1 text-xs text-slate-500">{selectedServer.service_count} service trên server này</p>}</FormField>
      <FormField id="service-project" label="Project" error={fieldErrors.project}><CatalogCombobox id="service-project" value={form.project} loadOptions={listProjects} onChange={(value) => set("project", value)} placeholder="Gõ hoặc chọn project…" /></FormField>
      <FormField id="service-environment" label="Environment" error={fieldErrors.environment}><CatalogCombobox id="service-environment" value={form.environment} loadOptions={listEnvironments} onChange={(value) => set("environment", value)} placeholder="Gõ hoặc chọn environment…" /></FormField>
      <FormField id="service-type" label="Service type" error={fieldErrors.service_type}><ServiceTypePicker value={form.service_type} onChange={(value) => set("service_type", value)} onBusyChange={setSavingType} /></FormField>
      <FormField id="service-status" label="Status"><select id="service-status" value={form.status} onChange={(event) => set("status", event.target.value as ServicePayload["status"])} className={inputClass}>{["unknown", "running", "stopped", "degraded"].map((status) => <option key={status} value={status}>{status}</option>)}</select></FormField>
      <FormField id="service-container" label="Docker container"><input id="service-container" value={form.container_name ?? ""} onChange={(event) => set("container_name", event.target.value)} className={inputClass} /></FormField>
      <FormField id="service-image" label="Docker image"><input id="service-image" value={form.docker_image ?? ""} onChange={(event) => set("docker_image", event.target.value)} className={inputClass} /></FormField>
      <FormField id="service-compose" label="Compose path"><input id="service-compose" value={form.compose_path ?? ""} onChange={(event) => set("compose_path", event.target.value)} className={inputClass} /></FormField>
      <FormField id="service-workdir" label="Working directory"><input id="service-workdir" value={form.working_directory ?? ""} onChange={(event) => set("working_directory", event.target.value)} className={inputClass} /></FormField>
      <FormField id="service-owner" label="Owner"><input id="service-owner" value={form.owner ?? ""} onChange={(event) => set("owner", event.target.value)} className={inputClass} /></FormField>
      <div className="md:col-span-2"><FormField id="service-description" label="Description"><textarea id="service-description" value={form.description ?? ""} onChange={(event) => set("description", event.target.value)} className={textareaClass} /></FormField></div>
      <div className="md:col-span-2"><FormField id="service-notes" label="Notes"><textarea id="service-notes" value={form.notes ?? ""} onChange={(event) => set("notes", event.target.value)} className={textareaClass} /></FormField></div>
    </div></section>
    {!isTriton && form.triton_model_names.length > 0 && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Khi lưu loại dịch vụ khác tritonserver, danh sách model name của dịch vụ này sẽ được gỡ.</p>}
    {isTriton && <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <Repeater label="Triton model names" addLabel="Thêm model" onAdd={() => { if (form.triton_model_names.length < 200) set("triton_model_names", [...form.triton_model_names, ""]); }}>
        <p className="text-sm text-slate-500">Tên model trên Triton server này. Mỗi dòng một model, tối đa 200 model; phân biệt chữ hoa/thường.</p>
        {form.triton_model_names.map((name, index) => <div key={index} className="flex items-start gap-2">
          <div className="flex-1"><input aria-label={`Model name ${index + 1}`} maxLength={200} value={name} onChange={(event) => set("triton_model_names", form.triton_model_names.map((value, current) => current === index ? event.target.value : value))} className={inputClass} placeholder="yolor, whisper, embedding…" />
            {fieldErrors[`triton_model_names.${index}`] && <p className="text-sm text-red-700">{fieldErrors[`triton_model_names.${index}`]}</p>}
          </div>
          <button type="button" onClick={() => set("triton_model_names", form.triton_model_names.filter((_, current) => current !== index))} aria-label={`Xoá model ${index + 1}`} className="rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50">Xoá</button>
        </div>)}
        {!form.triton_model_names.length && <p className="text-sm text-slate-500">Chưa khai báo model. Bấm + Thêm model để thêm dòng.</p>}
        {fieldErrors.triton_model_names && <p role="alert" className="text-sm text-red-700">{fieldErrors.triton_model_names}</p>}
      </Repeater>
    </section>}
    <DependencyPicker serviceId={service?.id} ids={form.dependency_ids} initial={service?.dependencies} onChange={(ids) => set("dependency_ids", ids)} />
    <section className="grid gap-8 lg:grid-cols-2"><div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><TokenEditor label="Aliases" values={form.aliases} onChange={(values) => set("aliases", values)} placeholder="s2t, speech" /><SavedTagEditor label="Tags" values={form.tags} onChange={(values) => set("tags", values)} placeholder="gpu, asr" /></div><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><Repeater label="Ports" onAdd={() => set("ports", [...form.ports, emptyPort()])}>{form.ports.map((port, index) => <div key={`${port.name}-${index}`} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_100px_120px_auto]"><input aria-label="Tên port" value={port.name} onChange={(event) => updatePort(index, { name: event.target.value })} className={inputClass} placeholder="HTTP" /><input aria-label="Số port" type="number" min={1} max={65535} value={port.port} onChange={(event) => updatePort(index, { port: Number(event.target.value) })} className={inputClass} /><select aria-label="Protocol" value={port.protocol} onChange={(event) => updatePort(index, { protocol: event.target.value })} className={inputClass}><option>tcp</option><option>udp</option><option>http</option><option>https</option><option>grpc</option><option>amqp</option><option>amqps</option><option>redis</option><option>postgresql</option><option>other</option></select><button type="button" onClick={() => set("ports", form.ports.filter((_, current) => current !== index))} className="rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">Xoá</button><input aria-label="Mô tả port" value={port.description ?? ""} onChange={(event) => updatePort(index, { description: event.target.value })} className={`${inputClass} sm:col-span-3`} placeholder="Mô tả" /></div>)}</Repeater></div></section>
    <section className="grid gap-8 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><Repeater label="Endpoints" onAdd={() => set("endpoints", [...form.endpoints, emptyEndpoint()])}>{form.endpoints.map((endpoint, index) => <div key={`${endpoint.name}-${index}`} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_140px_auto]"><input aria-label="Tên endpoint" value={endpoint.name} onChange={(event) => updateEndpoint(index, { name: event.target.value })} className={inputClass} /><select aria-label="Loại endpoint" value={endpoint.endpoint_type} onChange={(event) => updateEndpoint(index, { endpoint_type: event.target.value })} className={inputClass}><option>endpoint</option><option>swagger</option><option>management</option><option>healthcheck</option><option>metrics</option><option>other</option></select><button type="button" onClick={() => set("endpoints", form.endpoints.filter((_, current) => current !== index))} className="rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">Xoá</button><input aria-label="URL endpoint" value={endpoint.url} onChange={(event) => updateEndpoint(index, { url: event.target.value })} className={`${inputClass} sm:col-span-2`} placeholder="https://…" /></div>)}</Repeater><div className="mt-6 grid gap-4 sm:grid-cols-3"><FormField id="healthcheck-url" label="Healthcheck URL" hint="HTTP/HTTPS"><input id="healthcheck-url" value={form.healthcheck_url ?? ""} onChange={(event) => set("healthcheck_url", event.target.value)} className={inputClass} /></FormField><FormField id="swagger-url" label="Swagger URL"><input id="swagger-url" value={form.swagger_url ?? ""} onChange={(event) => set("swagger_url", event.target.value)} className={inputClass} /></FormField><FormField id="management-url" label="Management URL"><input id="management-url" value={form.management_url ?? ""} onChange={(event) => set("management_url", event.target.value)} className={inputClass} /></FormField></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><Repeater label="Commands" addLabel="Thêm command" onAdd={() => set("commands", [...form.commands, emptyCommand()])}>{form.commands.map((command, index) => <div key={`${command.name}-${index}`} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]"><input aria-label="Tên command" value={command.name} onChange={(event) => updateCommand(index, { name: event.target.value })} className={inputClass} placeholder="Logs" /><select aria-label="Loại command" value={command.command_type} onChange={(event) => updateCommand(index, { command_type: event.target.value })} className={inputClass}><option>ssh</option><option>start</option><option>stop</option><option>restart</option><option>logs</option><option>custom</option></select><button type="button" onClick={() => set("commands", form.commands.filter((_, current) => current !== index))} className="rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">Xoá</button></div><textarea aria-label="Command" value={command.command} onChange={(event) => updateCommand(index, { command: event.target.value })} className={textareaClass} placeholder="docker logs …" /></div>)}</Repeater></div></section>
  </form>;
}
