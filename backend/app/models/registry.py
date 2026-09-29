from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger, CheckConstraint, Computed, DateTime, ForeignKey, Index, Integer,
    MetaData, String, Text, UniqueConstraint, Uuid, func, text,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix": "ix_%(table_name)s_%(column_0_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })


class IdentityMixin:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Database triggers manage updated_at, including writes outside SQLAlchemy.


class Server(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "servers"
    __table_args__ = (
        CheckConstraint("ssh_port BETWEEN 1 AND 65535", name="ssh_port_range"),
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint("masklen(ip) = CASE family(ip) WHEN 4 THEN 32 ELSE 128 END", name="ip_host"),
        Index("uq_servers_name_lower", func.lower(text("name")), unique=True),
    )

    name: Mapped[str] = mapped_column(String(200))
    hostname: Mapped[str | None] = mapped_column(String(253))
    ip: Mapped[str] = mapped_column(INET, index=True)
    ssh_port: Mapped[int] = mapped_column(Integer, server_default="22")
    ssh_user: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(200))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list, server_default=text("'{}'"))
    services: Mapped[list["Service"]] = relationship(back_populates="server", passive_deletes="all")


class Service(IdentityMixin, TimestampMixin, Base):
    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint("status IN ('unknown', 'running', 'stopped', 'degraded')", name="status_values"),
        CheckConstraint("access_count >= 0", name="access_count_nonnegative"),
        Index("uq_services_server_name_lower", "server_id", func.lower(text("name")), unique=True),
        Index("ix_services_search_text_trgm", "search_text", postgresql_using="gin",
              postgresql_ops={"search_text": "gin_trgm_ops"}),
        Index("ix_services_search_vector", "search_vector", postgresql_using="gin"),
    )

    server_id: Mapped[UUID] = mapped_column(ForeignKey("servers.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    project: Mapped[str | None] = mapped_column(String(200), index=True)
    environment: Mapped[str | None] = mapped_column(String(100), index=True)
    service_type: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), server_default="unknown")
    container_name: Mapped[str | None] = mapped_column(String(255))
    docker_image: Mapped[str | None] = mapped_column(String(500))
    compose_path: Mapped[str | None] = mapped_column(String(2000))
    working_directory: Mapped[str | None] = mapped_column(String(2000))
    healthcheck_url: Mapped[str | None] = mapped_column(String(2048))
    swagger_url: Mapped[str | None] = mapped_column(String(2048))
    management_url: Mapped[str | None] = mapped_column(String(2048))
    owner: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    access_count: Mapped[int] = mapped_column(BigInteger, server_default="0", index=True)
    search_text: Mapped[str] = mapped_column(Text, server_default="")
    search_vector: Mapped[str] = mapped_column(TSVECTOR, Computed(
        "to_tsvector('simple'::regconfig, search_text)", persisted=True
    ))
    server: Mapped[Server] = relationship(back_populates="services")
    ports: Mapped[list["ServicePort"]] = relationship(back_populates="service", cascade="all, delete-orphan", passive_deletes=True)
    aliases: Mapped[list["ServiceAlias"]] = relationship(back_populates="service", cascade="all, delete-orphan", passive_deletes=True)
    tags: Mapped[list["ServiceTag"]] = relationship(back_populates="service", cascade="all, delete-orphan", passive_deletes=True)
    commands: Mapped[list["ServiceCommand"]] = relationship(back_populates="service", cascade="all, delete-orphan", passive_deletes=True)
    endpoints: Mapped[list["ServiceEndpoint"]] = relationship(back_populates="service", cascade="all, delete-orphan", passive_deletes=True)


class SavedTag(Base):
    __tablename__ = "saved_tags"
    __table_args__ = (
        CheckConstraint("length(btrim(value)) > 0", name="value_not_blank"),
        Index("uq_saved_tags_value_lower", func.lower(text("value")), unique=True),
    )
    value: Mapped[str] = mapped_column(String(100), primary_key=True)


class ServiceDependency(Base):
    __tablename__ = "service_dependencies"
    __table_args__ = (
        CheckConstraint("service_id <> dependency_id", name="not_self"),
        Index("ix_service_dependencies_dependency_id", "dependency_id"),
    )
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), primary_key=True)
    dependency_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="RESTRICT"), primary_key=True)


class ServicePort(IdentityMixin, Base):
    __tablename__ = "service_ports"
    __table_args__ = (
        CheckConstraint("port BETWEEN 1 AND 65535", name="port_range"),
        CheckConstraint("protocol IN ('tcp','udp','http','https','grpc','amqp','amqps','redis','postgresql','other')", name="protocol_values"),
        UniqueConstraint("service_id", "port", "protocol", "name"),
    )
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    port: Mapped[int] = mapped_column(Integer, index=True)
    protocol: Mapped[str] = mapped_column(String(20), server_default="tcp")
    description: Mapped[str | None] = mapped_column(Text)
    service: Mapped[Service] = relationship(back_populates="ports")


class ServiceAlias(IdentityMixin, Base):
    __tablename__ = "service_aliases"
    __table_args__ = (Index("uq_service_aliases_value_lower", "service_id", func.lower(text("alias")), unique=True),)
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    alias: Mapped[str] = mapped_column(String(200))
    service: Mapped[Service] = relationship(back_populates="aliases")


class ServiceTag(Base):
    __tablename__ = "service_tags"
    __table_args__ = (Index("uq_service_tags_value_lower", "service_id", func.lower(text("tag")), unique=True),)
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), primary_key=True)
    tag: Mapped[str] = mapped_column(String(100), primary_key=True, index=True)
    service: Mapped[Service] = relationship(back_populates="tags")


class ServiceCommand(IdentityMixin, Base):
    __tablename__ = "service_commands"
    __table_args__ = (CheckConstraint("command_type IN ('ssh','start','stop','restart','logs','custom')", name="type_values"),)
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    command: Mapped[str] = mapped_column(Text)
    command_type: Mapped[str] = mapped_column(String(20), server_default="custom")
    service: Mapped[Service] = relationship(back_populates="commands")


class ServiceEndpoint(IdentityMixin, Base):
    __tablename__ = "service_endpoints"
    __table_args__ = (CheckConstraint("endpoint_type IN ('endpoint','swagger','management','healthcheck','metrics','other')", name="type_values"),)
    service_id: Mapped[UUID] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(2048))
    endpoint_type: Mapped[str] = mapped_column(String(20), server_default="endpoint")
    service: Mapped[Service] = relationship(back_populates="endpoints")
