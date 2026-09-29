"""Persist reusable tags independently of service/server assignments.

Revision ID: 0003_saved_tags
Revises: 0002_service_dependencies
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_saved_tags"
down_revision = "0002_service_dependencies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_tags",
        sa.Column("value", sa.String(100), primary_key=True),
        sa.CheckConstraint("length(btrim(value)) > 0", name="value_not_blank"),
    )
    op.create_index("uq_saved_tags_value_lower", "saved_tags", [sa.text("lower(value)")], unique=True)
    op.execute("""
        INSERT INTO saved_tags (value)
        SELECT DISTINCT ON (lower(value)) value
        FROM (
            SELECT btrim(tag) AS value FROM service_tags
            UNION ALL
            SELECT btrim(unnest(tags)) AS value FROM servers
        ) existing
        WHERE length(value) > 0
        ORDER BY lower(value), value
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("saved_tags")
