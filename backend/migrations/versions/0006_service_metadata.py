"""Add run command and Komodo path metadata to services.

Revision ID: 0006_service_metadata
Revises: 0005_search_triton_models
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_service_metadata"
down_revision = "0005_search_triton_models"
branch_labels = None
depends_on = None


def _replace_search_function(include_metadata: bool) -> None:
    metadata_fields = "        s.run_command, s.komodo_path,\n" if include_metadata else ""
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
{metadata_fields}        s.healthcheck_url, s.swagger_url, s.management_url, s.owner, s.notes,
        host(h.ip), h.name, h.hostname, h.ssh_port::text, h.ssh_user,
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


def upgrade() -> None:
    op.add_column("services", sa.Column("run_command", sa.Text(), nullable=True))
    op.add_column("services", sa.Column("komodo_path", sa.String(2000), nullable=True))
    _replace_search_function(include_metadata=True)
    op.execute("""
        CREATE TRIGGER services_metadata_updated_at BEFORE UPDATE OF run_command, komodo_path ON services
        FOR EACH ROW EXECUTE FUNCTION portatlas_touch_updated_at()
    """)
    op.execute("""
        CREATE TRIGGER services_metadata_search AFTER UPDATE OF run_command, komodo_path ON services
        FOR EACH ROW EXECUTE FUNCTION portatlas_service_changed()
    """)
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


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS services_metadata_search ON services")
    op.execute("DROP TRIGGER IF EXISTS services_metadata_updated_at ON services")
    _replace_search_function(include_metadata=False)
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
    op.drop_column("services", "komodo_path")
    op.drop_column("services", "run_command")
