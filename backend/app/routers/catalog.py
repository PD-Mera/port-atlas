from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models import SavedServiceType, SavedTag, Service, ServiceTag
from app.schemas.common import CatalogItem, Page
from app.schemas.registry import SavedTagsInput, ServiceTypeInput
from app.services.tags import remember_tags
from app.services.service_types import remember_service_type

router = APIRouter(tags=["catalog"])


@router.get("/service-types", response_model=Page[CatalogItem])
def list_service_types(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    session: Session = Depends(get_session),
) -> Page[CatalogItem]:
    filters = []
    if q and q.strip():
        filters.append(SavedServiceType.value.contains(q.strip().lower(), autoescape=True))
    usage_count = select(func.count(Service.id)).where(
        func.lower(func.btrim(Service.service_type)) == SavedServiceType.value
    ).correlate(SavedServiceType).scalar_subquery()
    total = session.scalar(select(func.count()).select_from(SavedServiceType).where(*filters)) or 0
    rows = session.execute(select(SavedServiceType.value, usage_count.label("count"))
                           .where(*filters).order_by(SavedServiceType.value)
                           .offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[CatalogItem(value=value, count=count) for value, count in rows],
                total=total, page=page, page_size=page_size)


@router.post("/service-types", response_model=CatalogItem)
def save_service_type(payload: ServiceTypeInput, session: Session = Depends(get_session)) -> CatalogItem:
    remember_service_type(session, payload.value)
    session.commit()
    count = session.scalar(select(func.count(Service.id)).where(
        func.lower(func.btrim(Service.service_type)) == payload.value
    )) or 0
    return CatalogItem(value=payload.value, count=count)


@router.get("/environments", response_model=Page[CatalogItem])
def list_environments(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    session: Session = Depends(get_session),
) -> Page[CatalogItem]:
    filters = [Service.environment.is_not(None)]
    if q and q.strip():
        filters.append(func.lower(Service.environment).contains(q.strip().lower(), autoescape=True))
    grouped = (
        select(Service.environment.label("value"), func.count(Service.id).label("count"))
        .where(*filters)
        .group_by(Service.environment)
    )
    total = session.scalar(select(func.count()).select_from(grouped.subquery())) or 0
    rows = session.execute(
        grouped.order_by(func.lower(Service.environment), Service.environment)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(items=[CatalogItem(value=value, count=count) for value, count in rows],
                total=total, page=page, page_size=page_size)


@router.delete("/service-types/{value}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_type(
    value: str = Path(min_length=1, max_length=100),
    session: Session = Depends(get_session),
) -> None:
    normalized = value.strip().lower()
    service_type = session.scalar(select(SavedServiceType).where(SavedServiceType.value == normalized))
    if service_type is None:
        raise HTTPException(status_code=404, detail="Service type not found")
    usage_count = session.scalar(select(func.count(Service.id)).where(
        func.lower(func.btrim(Service.service_type)) == normalized
    )) or 0
    if usage_count:
        raise HTTPException(status_code=409, detail="Không thể xoá service type đang được sử dụng")
    session.delete(service_type)
    session.commit()


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
        filters.append(func.lower(SavedTag.value).contains(q.strip().lower(), autoescape=True))
    usage_count = select(func.count(ServiceTag.service_id)).where(
        func.lower(ServiceTag.tag) == func.lower(SavedTag.value)
    ).correlate(SavedTag).scalar_subquery()
    grouped = (
        select(SavedTag.value.label("value"), usage_count.label("count"))
        .where(*filters)
    )
    total = session.scalar(select(func.count()).select_from(grouped.subquery())) or 0
    rows = session.execute(
        grouped.order_by(func.lower(SavedTag.value), SavedTag.value)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return _catalog_page([CatalogItem(value=value, count=count) for value, count in rows], total, page, page_size)


@router.post("/tags", response_model=list[str])
def save_tags(payload: SavedTagsInput, session: Session = Depends(get_session)) -> list[str]:
    remember_tags(session, payload.tags)
    session.commit()
    # Return the stored spelling when a case-insensitive duplicate was supplied.
    return list(session.scalars(select(SavedTag.value).where(
        func.lower(SavedTag.value).in_([value.lower() for value in payload.tags])
    ).order_by(func.lower(SavedTag.value), SavedTag.value)))
