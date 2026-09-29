from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import SavedTag
from app.schemas.registry import normalize_labels


def remember_tags(session: Session, values: list[str]) -> None:
    """Keep reusable tags in the caller's transaction, even after assignments disappear."""
    tags = normalize_labels(values)
    if tags:
        session.execute(insert(SavedTag).values([
            {"value": value} for value in tags
        ]).on_conflict_do_nothing())
