from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_session
from app.models import Server, Service, ServiceAlias, ServiceCommand, ServiceEndpoint, ServicePort, ServiceTag
from app.schemas.common import AccessRead, Page
from app.schemas.registry import ServiceInput, ServiceRead, ServiceSummary, Status
from app.services.registry import service_from_input

router = APIRouter(prefix="/services", tags=["services"])

SERVICE_LOAD_OPTIONS = (
    selectinload(Service.server),
    selectinload(Service.aliases),
    selectinload(Service.tags),
    selectinload(Service.ports),
    selectinload(Service.commands),
    selectinload(Service.endpoints),
)


def _service_query(service_id: UUID) -> object:
    return select(Service).where(Service.id == service_id).options(*SERVICE_LOAD_OPTIONS)


def service_summary(service: Service) -> ServiceSummary:
    return ServiceSummary(
        id=service.id,
        name=service.name,
        server_id=service.server_id,
        server_name=service.server.name,
        server_ip=str(service.server.ip),
        project=service.project,
        environment=service.environment,
        service_type=service.service_type,
        status=service.status,
        container_name=service.container_name,
        docker_image=service.docker_image,
        description=service.description,
        aliases=[item.alias for item in service.aliases],
        tags=[item.tag for item in service.tags],
        ports=service.ports,
    )


@router.get("", response_model=Page[ServiceSummary])
def list_services(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    server_id: UUID | None = None,
    project: str | None = Query(None, max_length=200),
    tag: str | None = Query(None, max_length=100),
    status_filter: Status | None = Query(None, alias="status"),
    session: Session = Depends(get_session),
) -> Page[ServiceSummary]:
    filters = []
    if server_id is not None:
        filters.append(Service.server_id == server_id)
    if project:
        filters.append(func.lower(Service.project).contains(project.strip().lower(), autoescape=True))
    if tag:
        filters.append(
            select(ServiceTag.service_id)
            .where(ServiceTag.service_id == Service.id, func.lower(ServiceTag.tag) == tag.strip().lower())
            .exists()
        )
    if status_filter:
        filters.append(func.lower(Service.status) == status_filter.strip().lower())
    base = select(Service).where(*filters)
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    services = session.scalars(
        select(Service).where(*filters).options(*SERVICE_LOAD_OPTIONS)
        .order_by(func.lower(Service.name), Service.id)
        .offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page(items=[service_summary(item) for item in services], total=total, page=page, page_size=page_size)


@router.get("/{service_id}", response_model=ServiceRead)
def get_service(service_id: UUID, session: Session = Depends(get_session)) -> ServiceRead:
    service = session.scalar(_service_query(service_id))
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return ServiceRead.model_validate(service)


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(payload: ServiceInput, session: Session = Depends(get_session)) -> ServiceRead:
    if session.get(Server, payload.server_id) is None:
        raise HTTPException(status_code=422, detail="server_id does not reference an existing server")
    service = service_from_input(payload)
    session.add(service)
    session.commit()
    service = session.scalar(_service_query(service.id))
    if service is None:  # defensive: the just-committed record must exist
        raise HTTPException(status_code=500, detail="Created service could not be loaded")
    return ServiceRead.model_validate(service)


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(service_id: UUID, payload: ServiceInput, session: Session = Depends(get_session)) -> ServiceRead:
    service = session.scalar(_service_query(service_id))
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    if session.get(Server, payload.server_id) is None:
        raise HTTPException(status_code=422, detail="server_id does not reference an existing server")
    values = payload.model_dump(exclude={"aliases", "tags", "ports", "commands", "endpoints"})
    for field, value in values.items():
        setattr(service, field, value)
    # Clear first so replacing a value with the same unique alias/tag/port does
    # not depend on the ORM's orphan-delete ordering during flush.
    service.aliases.clear()
    service.tags.clear()
    service.ports.clear()
    service.commands.clear()
    service.endpoints.clear()
    session.flush()
    service.aliases.extend(ServiceAlias(alias=alias) for alias in payload.aliases)
    service.tags.extend(ServiceTag(tag=tag) for tag in payload.tags)
    service.ports.extend(ServicePort(**item.model_dump()) for item in payload.ports)
    service.commands.extend(ServiceCommand(**item.model_dump()) for item in payload.commands)
    service.endpoints.extend(ServiceEndpoint(**item.model_dump()) for item in payload.endpoints)
    session.commit()
    service = session.scalar(_service_query(service_id))
    if service is None:
        raise HTTPException(status_code=500, detail="Updated service could not be loaded")
    return ServiceRead.model_validate(service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: UUID, session: Session = Depends(get_session)) -> None:
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    session.delete(service)
    session.commit()


@router.post("/{service_id}/access", response_model=AccessRead)
def record_service_access(service_id: UUID, session: Session = Depends(get_session)) -> AccessRead:
    result = session.execute(
        update(Service)
        .where(Service.id == service_id)
        .values(last_accessed_at=func.clock_timestamp(), access_count=Service.access_count + 1)
        .returning(Service.id, Service.last_accessed_at, Service.access_count)
    ).one_or_none()
    if result is None:
        raise HTTPException(status_code=404, detail="Service not found")
    session.commit()
    return AccessRead(id=result.id, last_accessed_at=result.last_accessed_at, access_count=result.access_count)
