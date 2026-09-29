import type {
  CatalogItem,
  Page,
  SearchResponse,
  Server,
  ServerDetail,
  ServerListItem,
  ServerPayload,
  Service,
  ServicePayload,
  ServiceSummary,
} from "./types";

export type ApiErrorBody = {
  code: string;
  message: string;
  details: { field: string; message: string }[];
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
  }
}

// Browser-side requests only. The frontend proxy will keep /api on the same origin.
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("API path must start with /api/");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...options, headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error ?? {
      code: "request_failed", message: "Không thể hoàn thành yêu cầu", details: [],
    });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function params(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function searchRegistry(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(`/api/search${params({ q: query, page_size: 20 })}`, { signal });
}

export function listServers(options: { page?: number; page_size?: number; q?: string; signal?: AbortSignal } = {}) {
  const { signal, ...query } = options;
  return apiRequest<Page<ServerListItem>>(`/api/servers${params(query)}`, { signal });
}

export function getServer(id: string, signal?: AbortSignal): Promise<ServerDetail> {
  return apiRequest<ServerDetail>(`/api/servers/${encodeURIComponent(id)}`, { signal });
}

export function createServer(payload: ServerPayload): Promise<Server> {
  return apiRequest<Server>("/api/servers", { method: "POST", body: JSON.stringify(payload) });
}

export function updateServer(id: string, payload: ServerPayload): Promise<Server> {
  return apiRequest<Server>(`/api/servers/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteServer(id: string): Promise<void> {
  return apiRequest<void>(`/api/servers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listServices(options: {
  page?: number; page_size?: number; server_id?: string; project?: string; tag?: string; status?: string; q?: string; signal?: AbortSignal;
} = {}) {
  const { signal, ...query } = options;
  return apiRequest<Page<ServiceSummary>>(`/api/services${params(query)}`, { signal });
}

export function getService(id: string, signal?: AbortSignal): Promise<Service> {
  return apiRequest<Service>(`/api/services/${encodeURIComponent(id)}`, { signal });
}

export function createService(payload: ServicePayload): Promise<Service> {
  return apiRequest<Service>("/api/services", { method: "POST", body: JSON.stringify(payload) });
}

export function updateService(id: string, payload: ServicePayload): Promise<Service> {
  return apiRequest<Service>(`/api/services/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deleteService(id: string): Promise<void> {
  return apiRequest<void>(`/api/services/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function recordServiceAccess(id: string): Promise<{ id: string; last_accessed_at: string; access_count: number }> {
  return apiRequest<{ id: string; last_accessed_at: string; access_count: number }>(`/api/services/${encodeURIComponent(id)}/access`, { method: "POST" });
}

export function listCatalog(kind: "projects" | "tags", signal?: AbortSignal): Promise<Page<CatalogItem>> {
  return apiRequest<Page<CatalogItem>>(`/api/${kind}?page_size=100`, { signal });
}

export function listSavedTags(options: { q?: string; page?: number; signal?: AbortSignal } = {}) {
  const { signal, ...query } = options;
  return apiRequest<Page<CatalogItem>>(`/api/tags${params({ ...query, page_size: 20 })}`, { signal });
}

export function saveTags(tags: string[]): Promise<string[]> {
  return apiRequest<string[]>("/api/tags", { method: "POST", body: JSON.stringify({ tags }) });
}

export function listServiceTypes(options: { page?: number; q?: string; signal?: AbortSignal } = {}) {
  const { signal, ...query } = options;
  return apiRequest<Page<CatalogItem>>(`/api/service-types${params({ ...query, page_size: 100 })}`, { signal });
}

export function saveServiceType(value: string): Promise<CatalogItem> {
  return apiRequest<CatalogItem>("/api/service-types", { method: "POST", body: JSON.stringify({ value }) });
}

export function deleteServiceType(value: string): Promise<void> {
  return apiRequest<void>(`/api/service-types/${encodeURIComponent(value)}`, { method: "DELETE" });
}
