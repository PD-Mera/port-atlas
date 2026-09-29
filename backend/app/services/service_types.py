from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import SavedServiceType


def remember_service_type(session: Session, value: str | None) -> None:
    if value and value.strip():
        session.execute(insert(SavedServiceType).values(
            value=value.strip().lower()
        ).on_conflict_do_nothing())
