"""Reusable service types and a dynamic list of Triton model names.

Revision ID: 0004_service_types_triton
Revises: 0003_saved_tags
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0004_service_types_triton"
down_revision = "0003_saved_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_service_types",
        sa.Column("value", sa.String(100), primary_key=True),
        sa.CheckConstraint("value = lower(btrim(value)) AND length(value) > 0", name="value_normalized"),
    )
    op.execute("""
        INSERT INTO saved_service_types (value)
        SELECT DISTINCT lower(btrim(service_type)) FROM services
        WHERE service_type IS NOT NULL AND length(btrim(service_type)) > 0
        ON CONFLICT DO NOTHING
    """)
    op.execute("""
        INSERT INTO saved_service_types (value) VALUES
        ('fastapi'), ('worker'), ('database'), ('postgresql'), ('redis'),
        ('rabbitmq'), ('nginx'), ('tritonserver'), ('other')
        ON CONFLICT DO NOTHING
    """)
    op.add_column("services", sa.Column("triton_model_names", pg.ARRAY(sa.String(200)), nullable=False, server_default=sa.text("'{}'")))
    op.create_check_constraint("triton_model_limit", "services", "cardinality(triton_model_names) <= 200")
    op.create_check_constraint("triton_models_type", "services", "cardinality(triton_model_names) = 0 OR coalesce(lower(btrim(service_type)), '') = 'tritonserver'")
    op.execute("""
        CREATE TRIGGER services_triton_models_updated_at BEFORE UPDATE OF triton_model_names ON services
        FOR EACH ROW EXECUTE FUNCTION portatlas_touch_updated_at()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER services_triton_models_updated_at ON services")
    op.drop_constraint(op.f("ck_services_triton_models_type"), "services", type_="check")
    op.drop_constraint(op.f("ck_services_triton_model_limit"), "services", type_="check")
    op.drop_column("services", "triton_model_names")
    op.drop_table("saved_service_types")
