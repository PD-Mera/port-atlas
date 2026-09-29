export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type Port = {
  id?: string;
  name: string;
  port: number;
  protocol: string;
  description?: string | null;
};

export type Command = {
  id?: string;
  name: string;
  command: string;
  command_type: string;
};

export type Endpoint = {
  id?: string;
  name: string;
  url: string;
  endpoint_type: string;
};

export type Server = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  hostname: string | null;
  ip: string;
  ssh_port: number;
  ssh_user: string | null;
  description: string | null;
  location: string | null;
  tags: string[];
};

export type ServerListItem = Server & { service_count: number };

export type ServiceSummary = {
  id: string;
  name: string;
  server_id: string;
  server_name: string;
  server_ip: string;
  project: string | null;
  environment: string | null;
  service_type: string | null;
  status: string;
  container_name: string | null;
  docker_image: string | null;
  description: string | null;
  aliases: string[];
  tags: string[];
  ports: Port[];
};

export type Service = ServiceSummary & {
  server: Server;
  server_id: string;
  description: string | null;
  compose_path: string | null;
  working_directory: string | null;
  healthcheck_url: string | null;
  swagger_url: string | null;
  management_url: string | null;
  owner: string | null;
  notes: string | null;
  commands: Command[];
  endpoints: Endpoint[];
  last_accessed_at: string | null;
  access_count: number;
  created_at: string;
  updated_at: string;
};

export type SearchItem = ServiceSummary & { score: number };

export type SearchResponse = {
  query: string;
  filters: { key: string; value: string }[];
  items: SearchItem[];
  total: number;
  page: number;
  page_size: number;
  recent: ServiceSummary[];
  frequent: ServiceSummary[];
};

export type CatalogItem = { value: string; count: number };

export type ServerPayload = {
  name: string;
  hostname: string | null;
  ip: string;
  ssh_port: number;
  ssh_user: string | null;
  description: string | null;
  location: string | null;
  tags: string[];
};

export type ServicePayload = {
  server_id: string;
  name: string;
  description: string | null;
  project: string | null;
  environment: string | null;
  service_type: string | null;
  status: "unknown" | "running" | "stopped" | "degraded";
  container_name: string | null;
  docker_image: string | null;
  compose_path: string | null;
  working_directory: string | null;
  healthcheck_url: string | null;
  swagger_url: string | null;
  management_url: string | null;
  owner: string | null;
  notes: string | null;
  aliases: string[];
  tags: string[];
  ports: Omit<Port, "id">[];
  commands: Omit<Command, "id">[];
  endpoints: Omit<Endpoint, "id">[];
};

export type ServerDetail = Server & { services: ServiceSummary[] };
