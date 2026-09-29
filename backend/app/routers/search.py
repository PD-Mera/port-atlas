from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import Service
from app.routers.services import SERVICE_LOAD_OPTIONS, service_summary
from app.schemas.registry import ServiceSummary
from app.schemas.search import SearchFilterRead, SearchItem, SearchResponse
from app.services.search import SearchSyntaxError, build_conditions, parse_query, search_score

router = APIRouter(prefix="/search", tags=["search"])


def _recent_or_frequent(session: Session, *, frequent: bool, limit: int) -> list[ServiceSummary]:
    order = (
        (desc(Service.access_count), desc(Service.last_accessed_at), func.lower(Service.name), Service.id)
        if frequent
        else (desc(Service.last_accessed_at), desc(Service.access_count), func.lower(Service.name), Service.id)
    )
    condition = Service.access_count > 0 if frequent else Service.last_accessed_at.is_not(None)
    services = session.scalars(
        select(Service)
        .where(condition)
        .options(*SERVICE_LOAD_OPTIONS)
        .order_by(*order)
        .limit(limit)
    ).all()
    return [service_summary(service) for service in services]


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> SearchResponse:
    try:
        parsed = parse_query(q)
    except SearchSyntaxError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not parsed.terms and not parsed.filters:
        limit = min(page_size, 20)
        return SearchResponse(
            query=q,
            filters=[],
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            recent=_recent_or_frequent(session, frequent=False, limit=limit),
            frequent=_recent_or_frequent(session, frequent=True, limit=limit),
        )

    conditions = build_conditions(parsed)
    score_expression = search_score(parsed.terms).label("score")
    total = session.scalar(
        select(func.count()).select_from(select(Service.id).where(*conditions).subquery())
    ) or 0
    rows = session.execute(
        select(Service, score_expression)
        .where(*conditions)
        .options(*SERVICE_LOAD_OPTIONS)
        .order_by(desc(score_expression), func.lower(Service.name), Service.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        SearchItem(**service_summary(service).model_dump(), score=max(0.0, float(score_value or 0)))
        for service, score_value in rows
    ]
    return SearchResponse(
        query=q,
        filters=[SearchFilterRead(key=item.key, value=item.value) for item in parsed.filters],
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
