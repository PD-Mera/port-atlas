"""Add directed service dependencies.

Revision ID: 0002_service_dependencies
Revises: 0001_registry
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_service_dependencies"
down_revision = "0001_registry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "service_dependencies",
        sa.Column("service_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("dependency_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="RESTRICT"), primary_key=True),
        sa.CheckConstraint("service_id <> dependency_id", name="not_self"),
    )
    op.create_index("ix_service_dependencies_dependency_id", "service_dependencies", ["dependency_id"])
    # Relation-only edits also update the registry timestamp.
    op.execute("""
        CREATE FUNCTION portatlas_touch_dependency_owner() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                UPDATE services SET updated_at = clock_timestamp() WHERE id = OLD.service_id;
                RETURN OLD;
            END IF;
            UPDATE services SET updated_at = clock_timestamp() WHERE id = NEW.service_id;
            RETURN NEW;
        END;
        $$;
    """)
    op.execute("""
        CREATE TRIGGER service_dependencies_touch AFTER INSERT OR DELETE ON service_dependencies
        FOR EACH ROW EXECUTE FUNCTION portatlas_touch_dependency_owner();
    """)


def downgrade() -> None:
    op.drop_table("service_dependencies")
    op.execute("DROP FUNCTION portatlas_touch_dependency_owner()")
