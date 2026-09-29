from datetime import datetime
from ipaddress import ip_address
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, Field, HttpUrl, TypeAdapter, field_validator, model_validator

from app.schemas.common import Record, Schema


def validate_ip(value: str) -> str:
    return str(ip_address(value))


def validate_http_url(value: str) -> str:
    # HttpUrl accepts internal hosts and IPs, and forbids executable URL schemes.
    parsed = TypeAdapter(HttpUrl).validate_python(value)
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Do not store credentials in URLs")
    normalized = str(parsed)
    if len(normalized) > 2048:
        raise ValueError("URL must be at most 2048 characters")
    return normalized


def normalize_labels(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = value.strip()
        key = normalized.lower()
        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)
    return result


Name = Annotated[str, Field(min_length=1, max_length=200)]
Label = Annotated[str, Field(min_length=1, max_length=100)]
Description = Annotated[str, Field(max_length=20000)]
IP = Annotated[str, AfterValidator(validate_ip)]
URL = Annotated[str, Field(max_length=2048), AfterValidator(validate_http_url)]
PortNumber = Annotated[int, Field(strict=True, ge=1, le=65535)]
Protocol = Literal["tcp", "udp", "http", "https", "grpc", "amqp", "amqps", "redis", "postgresql", "other"]
Status = Literal["unknown", "running", "stopped", "degraded"]
CommandType = Literal["ssh", "start", "stop", "restart", "logs", "custom"]
EndpointType = Literal["endpoint", "swagger", "management", "healthcheck", "metrics", "other"]


class ServerInput(Schema):
    name: Name
    hostname: Annotated[str, Field(min_length=1, max_length=253)] | None = None
    ip: IP
    ssh_port: PortNumber = 22
    ssh_user: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    description: Description | None = None
    location: Annotated[str, Field(max_length=200)] | None = None
    tags: list[Label] = Field(default_factory=list, max_length=100)

    @field_validator("tags", mode="before")
    @classmethod
    def clean_tags(cls, value: object) -> object:
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            return normalize_labels(value)
        return value


class SavedTagsInput(Schema):
    tags: list[Label] = Field(min_length=1, max_length=100)

    @field_validator("tags", mode="before")
    @classmethod
    def clean_tags(cls, value: object) -> object:
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            return normalize_labels(value)
        return value


class ServiceTypeInput(Schema):
    value: Label

    @field_validator("value", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class ServerRead(ServerInput, Record):
    @field_validator("ip", mode="before")
    @classmethod
    def stringify_ip(cls, value: object) -> str:
        # psycopg returns ipaddress objects for PostgreSQL INET.
        return str(value)


class PortInput(Schema):
    name: Label
    port: PortNumber
    protocol: Protocol = "tcp"
    description: Description | None = None


class PortRead(PortInput):
    id: UUID


class ServiceSummary(Schema):
    id: UUID
    name: str
    server_id: UUID
    server_name: str
    server_ip: str
    project: str | None = None
    environment: str | None = None
    service_type: str | None = None
    status: str
    container_name: str | None = None
    docker_image: str | None = None
    description: str | None = None
    aliases: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    ports: list[PortRead] = Field(default_factory=list)


class ServerDetailRead(ServerRead):
    services: list[ServiceSummary] = Field(default_factory=list)


class ServerListRead(ServerRead):
    service_count: int = Field(ge=0)


class CommandInput(Schema):
    name: Label
    command: Annotated[str, Field(min_length=1, max_length=10000)]
    command_type: CommandType = "custom"


class CommandRead(CommandInput):
    id: UUID


class EndpointInput(Schema):
    name: Label
    url: URL
    endpoint_type: EndpointType = "endpoint"


class EndpointRead(EndpointInput):
    id: UUID


class ServiceFields(Schema):
    server_id: UUID
    name: Name
    description: Description | None = None
    project: Annotated[str, Field(max_length=200)] | None = None
    environment: Annotated[str, Field(max_length=100)] | None = None
    service_type: Annotated[str, Field(max_length=100)] | None = None
    triton_model_names: list[Name] = Field(default_factory=list, max_length=200)
    status: Status = "unknown"
    container_name: Annotated[str, Field(max_length=255)] | None = None
    docker_image: Annotated[str, Field(max_length=500)] | None = None
    compose_path: Annotated[str, Field(max_length=2000)] | None = None
    working_directory: Annotated[str, Field(max_length=2000)] | None = None
    run_command: Annotated[str, Field(max_length=10000)] | None = None
    komodo_path: Annotated[str, Field(max_length=2000)] | None = None
    healthcheck_url: URL | None = None
    swagger_url: URL | None = None
    management_url: URL | None = None
    owner: Annotated[str, Field(max_length=200)] | None = None
    notes: Description | None = None


class ServiceInput(ServiceFields):
    @field_validator("service_type", mode="before")
    @classmethod
    def normalize_service_type(cls, value: object) -> object:
        return (value.strip().lower() or None) if isinstance(value, str) else value

    @field_validator("triton_model_names", mode="before")
    @classmethod
    def clean_model_names(cls, value: object) -> object:
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            # Triton model names are case-sensitive; remove exact duplicates only.
            return list(dict.fromkeys(item.strip() for item in value if item.strip()))
        return value

    @model_validator(mode="after")
    def validate_triton_models(self) -> "ServiceInput":
        if self.triton_model_names and self.service_type != "tritonserver":
            raise ValueError("Model names chỉ được khai báo cho service type tritonserver")
        return self

    dependency_ids: list[UUID] = Field(default_factory=list, max_length=100)

    @field_validator("dependency_ids")
    @classmethod
    def unique_dependencies(cls, values: list[UUID]) -> list[UUID]:
        return list(dict.fromkeys(values))

    aliases: list[Name] = Field(default_factory=list, max_length=100)
    tags: list[Label] = Field(default_factory=list, max_length=100)
    ports: list[PortInput] = Field(default_factory=list, max_length=100)
    commands: list[CommandInput] = Field(default_factory=list, max_length=100)
    endpoints: list[EndpointInput] = Field(default_factory=list, max_length=100)

    @field_validator("aliases", "tags", mode="before")
    @classmethod
    def clean_labels(cls, value: object) -> object:
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            return normalize_labels(value)
        return value

    @field_validator("ports")
    @classmethod
    def unique_ports(cls, values: list[PortInput]) -> list[PortInput]:
        keys = [(value.port, value.protocol, value.name) for value in values]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate port/protocol/name")
        return values


class ServiceReference(Schema):
    id: UUID
    name: str
    server_name: str
    server_ip: str
    status: str
    ports: list[PortRead] = Field(default_factory=list)


class ServiceRead(ServiceFields, Record):
    dependencies: list[ServiceReference] = Field(default_factory=list)
    dependents: list[ServiceReference] = Field(default_factory=list)
    server: ServerRead
    aliases: list[str]
    tags: list[str]
    ports: list[PortRead]
    commands: list[CommandRead]
    endpoints: list[EndpointRead]
    last_accessed_at: datetime | None
    access_count: int

    @field_validator("aliases", "tags", mode="before")
    @classmethod
    def unpack_labels(cls, values: object) -> object:
        if isinstance(values, list):
            return [value if isinstance(value, str) else getattr(value, "alias", getattr(value, "tag", "")) for value in values]
        return values
