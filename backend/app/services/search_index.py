import argparse
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import get_session_factory
from app.models import Service


def refresh_search_document(session: Session, service_id: UUID) -> None:
    """Repair an index in the caller's transaction; routine writes use DB triggers."""
    session.execute(text("SELECT portatlas_refresh_search(:service_id)"), {"service_id": service_id})


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild PortAtlas search documents (manual operation)")
    parser.add_argument("--apply", action="store_true", help="Confirm database writes")
    args = parser.parse_args()
    if not args.apply:
        parser.error("Pass --apply to rebuild the search index")
    with get_session_factory().begin() as session:
        # Consistent lock order matches the database server/child triggers.
        ids = session.scalars(select(Service.id).order_by(Service.id)).all()
        for service_id in ids:
            refresh_search_document(session, service_id)
    print(f"Reindexed {len(ids)} services")


if __name__ == "__main__":
    main()
