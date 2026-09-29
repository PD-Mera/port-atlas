# PortAtlas

PortAtlas is a lightweight internal service registry for quickly discovering services running across Linux servers.

It is designed to make it easy to find a service by name, alias, IP address, port, project, tag, Docker container, endpoint, or operational command without needing to remember where the service is deployed.

## Goals

- Find any service in seconds.
- Keep Linux server/service information in one searchable place.
- Search by partial information such as IP suffix, port, alias, project, or tag.
- Reduce the need to manually inspect servers, Docker containers, Compose files, or notes.
- Provide quick access to operational commands such as SSH, logs, restart, and health checks.

## Core Features

### Global Search

A single search bar should search across:

- Service name
- Aliases
- Server name
- Hostname
- IP address
- Ports
- Project
- Environment
- Tags
- Service type
- Docker container name
- Docker image
- Compose path
- Working directory
- Endpoint URLs
- Notes
- Operational commands

Examples:

```text
241 s2t
236 triton yolor
4067
rabbitmq
tag:gpu
server:241
project:s2t port:4067
```

Search should support multiple tokens and rank the most relevant matches first.

Suggested ranking priority:

1. Exact service name
2. Exact alias
3. Exact IP or port
4. Service-name prefix
5. Alias prefix
6. Tags
7. Project
8. Description and notes

### Service Registry

Each service can store:

- Name
- Aliases
- Description
- Server
- Project
- Environment
- Service type
- Status
- Ports
- Protocols
- URLs
- Docker container
- Docker image
- Compose path
- Working directory
- Healthcheck URL
- Swagger/OpenAPI URL
- Management URL
- Owner
- Tags
- Notes
- SSH command
- Start command
- Stop command
- Restart command
- Log command
- Created time
- Updated time

### Multiple Ports

A service may expose multiple ports.

Example:

```text
Triton
HTTP      8000
gRPC      8001
Metrics   8002
```

or:

```text
RabbitMQ
AMQP        5672
Management  15672
```

Every port should be searchable.

### Server Registry

Servers are stored independently from services.

Suggested server fields:

- Name
- Hostname
- IP address
- SSH port
- SSH user
- Description
- Location
- Tags

A server can have many services.

### Quick Actions

Search results and service details should provide one-click actions such as:

- Copy IP
- Copy port
- Copy URL
- Open endpoint
- Open Swagger
- Copy SSH command
- Copy Docker logs command
- Copy restart command
- Edit service

### Command Palette

Use `Ctrl + K` to open global search from anywhere.

The interface should support keyboard-first navigation:

```text
Ctrl + K       Open search
↑ / ↓          Navigate results
Enter          Open service
Esc            Close search
```

### Recent and Frequently Used Services

Track:

- `last_accessed_at`
- `access_count`

When the search bar is empty, show recent and frequently used services.

## Search Design

Instead of querying every field independently, maintain a normalized aggregate search field such as:

```text
search_text
```

Example:

```text
ttcp-s2t api
s2t
speech
ttcp
10.9.3.241
4067
http
fastapi
docker
asr
gpu
ttcp-s2t-api
/home1/ttcp-s2t
```

This field can be indexed for fast full-text and fuzzy search.

Recommended PostgreSQL features:

- `pg_trgm`
- `tsvector`
- GIN indexes

## Suggested Data Model

### servers

```text
id
name
hostname
ip
ssh_port
ssh_user
description
location
tags
created_at
updated_at
```

### services

```text
id
server_id
name
description
project
environment
service_type
container_name
docker_image
compose_path
working_directory
healthcheck_url
swagger_url
management_url
owner
notes
search_text
created_at
updated_at
```

### service_ports

```text
id
service_id
name
port
protocol
description
```

### service_aliases

```text
id
service_id
alias
```

### service_tags

```text
service_id
tag
```

### service_commands

```text
id
service_id
name
command
command_type
```

## UX Principles

PortAtlas should prioritize speed over dashboard complexity.

1. Search must be available everywhere.
2. Search by incomplete information must still work.
3. Important service information should be visible directly in results.
4. Common commands and URLs should be copyable with one click.
5. Users should rarely need more than a few seconds to locate a service.
6. Keyboard navigation should work without requiring a mouse.

Example search result:

```text
TTCP-S2T API
10.9.3.241:4067

Project: TTCP-S2T
Container: ttcp-s2t-api
Environment: Production

speech  asr  gpu  fastapi

[Open] [Swagger] [SSH] [Copy URL]
```

## MVP Scope

The first version should contain only the features necessary for fast service discovery.

Recommended MVP screens:

1. Global Search
2. Service Detail
3. Add/Edit Service
4. Servers
5. Projects / Tags

Monitoring, automatic discovery, and server agents can be added later.

## Future Features

Possible Phase 2 features:

- Docker auto-discovery
- Port discovery using `ss`
- Systemd service discovery
- Periodic health checks
- Service status history
- Server agents
- Import from Docker Compose
- Bulk import/export
- API access
- Role-based access control
- Service dependencies
- Deployment history

Example discovery sources:

```bash
docker ps
ss -lntup
systemctl
```

## Suggested Tech Stack

### Frontend

```text
Next.js
Tailwind CSS
```

### Backend

```text
FastAPI
```

### Database

```text
PostgreSQL
pg_trgm
tsvector
```

Architecture:

```text
Browser
   |
   v
Next.js
   |
   v
FastAPI
   |
   v
PostgreSQL
   |- pg_trgm
   `- tsvector
```

## Project Description

> A lightweight service registry for quickly discovering Linux server services, ports, endpoints, Docker containers, and operational commands.
