from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(
        get_settings().sqlalchemy_url(), pool_pre_ping=True, pool_size=5, max_overflow=10
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    # Endpoints explicitly commit after all changes; failed requests roll back.
    with get_session_factory()() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
