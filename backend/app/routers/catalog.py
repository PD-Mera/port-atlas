from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import Service, ServiceTag
from app.schemas.common import CatalogItem, Page

router = APIRouter(tags=["catalog"])


def _catalog_page(items: list[CatalogItem], total: int, page: int, page_size: int) -> Page[CatalogItem]:
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/projects", response_model=Page[CatalogItem])
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    session: Session = Depends(get_session),
) -> Page[CatalogItem]:
    filters = [Service.project.is_not(None)]
    if q and q.strip():
        filters.append(func.lower(Service.project).contains(q.strip().lower(), autoescape=True))
    grouped = (
        select(Service.project.label("value"), func.count(Service.id).label("count"))
        .where(*filters)
        .group_by(Service.project)
    )
    total = session.scalar(select(func.count()).select_from(grouped.subquery())) or 0
    rows = session.execute(
        grouped.order_by(func.lower(Service.project), Service.project)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return _catalog_page([CatalogItem(value=value, count=count) for value, count in rows], total, page, page_size)


@router.get("/tags", response_model=Page[CatalogItem])
def list_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    session: Session = Depends(get_session),
) -> Page[CatalogItem]:
    filters = []
    if q and q.strip():
        filters.append(func.lower(ServiceTag.tag).contains(q.strip().lower(), autoescape=True))
    grouped = (
        select(ServiceTag.tag.label("value"), func.count(ServiceTag.service_id).label("count"))
        .where(*filters)
        .group_by(ServiceTag.tag)
    )
    total = session.scalar(select(func.count()).select_from(grouped.subquery())) or 0
    rows = session.execute(
        grouped.order_by(func.lower(ServiceTag.tag), ServiceTag.tag)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return _catalog_page([CatalogItem(value=value, count=count) for value, count in rows], total, page, page_size)
