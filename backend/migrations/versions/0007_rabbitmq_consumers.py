"""Store RabbitMQ consumer destinations for services.

Revision ID: 0007_rabbitmq_consumers
Revises: 0006_service_metadata
"""
from alembic import op
import sqlalchemy as sa


revision = "0007_rabbitmq_consumers"
down_revision = "0006_service_metadata"
branch_labels = None
depends_on = None


def _replace_search_function(include_rabbitmq: bool) -> None:
    rabbitmq_fields = """        (SELECT string_agg(concat_ws(' ', host, port::text, protocol, virtual_host, queue, exchange, routing_key, consumer_tag), ' ' ORDER BY host, port, protocol, virtual_host, queue)
            FROM service_rabbitmq_consumers WHERE service_id = s.id),
""" if include_rabbitmq else ""
    op.execute(rf"""
CREATE OR REPLACE FUNCTION portatlas_refresh_search(target_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Serialize refreshes for this service. A cascading DELETE may leave no row.
    PERFORM 1 FROM services WHERE id = target_id FOR UPDATE;
    IF NOT FOUND THEN RETURN; END IF;
    UPDATE services AS s SET search_text = lower(regexp_replace(concat_ws(' ',
        s.name, s.description, s.project, s.environment, s.service_type,
        array_to_string(s.triton_model_names, ' '), s.status,
        s.container_name, s.docker_image, s.compose_path, s.working_directory,
        s.run_command, s.komodo_path,
        s.healthcheck_url, s.swagger_url, s.management_url, s.owner, s.notes,
{rabbitmq_fields}        host(h.ip), h.name, h.hostname, h.ssh_port::text, h.ssh_user,
        h.description, h.location, array_to_string(h.tags, ' '),
        (SELECT string_agg(alias, ' ' ORDER BY alias) FROM service_aliases WHERE service_id = s.id),
        (SELECT string_agg(tag, ' ' ORDER BY tag) FROM service_tags WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, port::text, protocol, description), ' ' ORDER BY port, name)
            FROM service_ports WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, url, endpoint_type), ' ' ORDER BY name, id)
            FROM service_endpoints WHERE service_id = s.id),
        (SELECT string_agg(concat_ws(' ', name, command, command_type), ' ' ORDER BY name, id)
            FROM service_commands WHERE service_id = s.id)
    ), '\s+', ' ', 'g')) FROM servers AS h
    WHERE s.id = target_id AND h.id = s.server_id;
END;
$$;
    """)


def _reindex_services() -> None:
    op.execute("""
        DO $$
        DECLARE target_id uuid;
        BEGIN
            FOR target_id IN SELECT id FROM services ORDER BY id LOOP
                PERFORM portatlas_refresh_search(target_id);
            END LOOP;
        END;
        $$;
    """)


def upgrade() -> None:
    op.create_table(
        "service_rabbitmq_consumers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("service_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False),
        sa.Column("host", sa.String(253), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="5672"),
        sa.Column("protocol", sa.String(10), nullable=False, server_default="amqp"),
        sa.Column("virtual_host", sa.String(255), nullable=False, server_default="/"),
        sa.Column("queue", sa.String(255), nullable=False),
        sa.Column("exchange", sa.String(255)),
        sa.Column("routing_key", sa.String(255)),
        sa.Column("consumer_tag", sa.String(255)),
        sa.CheckConstraint("port BETWEEN 1 AND 65535", name=op.f("ck_service_rabbitmq_consumers_port_range")),
        sa.CheckConstraint("protocol IN ('amqp','amqps')", name=op.f("ck_service_rabbitmq_consumers_protocol_values")),
    )
    op.create_index("ix_service_rabbitmq_consumers_service_id", "service_rabbitmq_consumers", ["service_id"])
    _replace_search_function(include_rabbitmq=True)
    op.execute("""
        CREATE TRIGGER service_rabbitmq_consumers_search
        AFTER INSERT OR UPDATE OR DELETE ON service_rabbitmq_consumers
        FOR EACH ROW EXECUTE FUNCTION portatlas_child_changed();
    """)
    _reindex_services()


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS service_rabbitmq_consumers_search ON service_rabbitmq_consumers")
    _replace_search_function(include_rabbitmq=False)
    _reindex_services()
    op.drop_index("ix_service_rabbitmq_consumers_service_id", table_name="service_rabbitmq_consumers")
    op.drop_table("service_rabbitmq_consumers")
