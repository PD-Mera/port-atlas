from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_session
from app.models import Server, Service, ServiceAlias, ServiceCommand, ServiceDependency, ServiceEndpoint, ServicePort, ServiceTag
from app.schemas.common import AccessRead, Page
from app.schemas.registry import ServiceInput, ServiceRead, ServiceReference, ServiceSummary, Status
from app.services.registry import service_from_input
from app.services.tags import remember_tags
from app.services.service_types import remember_service_type

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
    return select(Service).where(Service.id == service_id).options(*SERVICE_LOAD_OPTIONS).execution_options(populate_existing=True)


def _lock_dependencies(session: Session) -> None:
    # Serialize graph writes so concurrent A -> B and B -> A cannot bypass validation.
    session.execute(text("SELECT pg_advisory_xact_lock(734812, 2)"))


def _validate_dependencies(session: Session, ids: list[UUID], service_id: UUID | None = None) -> None:
    if service_id in ids:
        raise HTTPException(status_code=422, detail="Dịch vụ không thể phụ thuộc vào chính nó")
    if not ids:
        return
    existing = set(session.scalars(select(Service.id).where(Service.id.in_(ids))))
    if existing != set(ids):
        raise HTTPException(status_code=422, detail="Một hoặc nhiều dịch vụ phụ thuộc không còn tồn tại")
    if service_id is not None:
        reachable = select(ServiceDependency.dependency_id.label("id")).where(
            ServiceDependency.service_id.in_(ids)
        ).cte("reachable_dependencies", recursive=True)
        reachable = reachable.union(select(ServiceDependency.dependency_id).join(
            reachable, ServiceDependency.service_id == reachable.c.id
        ))
        if session.scalar(select(reachable.c.id).where(reachable.c.id == service_id).limit(1)):
            raise HTTPException(status_code=422, detail="Quan hệ này tạo vòng phụ thuộc giữa các dịch vụ")


def _service_read(session: Session, service: Service) -> ServiceRead:
    result = ServiceRead.model_validate(service)

    def references(reverse: bool = False) -> list[ServiceReference]:
        target = ServiceDependency.service_id if reverse else ServiceDependency.dependency_id
        owner = ServiceDependency.dependency_id if reverse else ServiceDependency.service_id
        rows = session.scalars(
            select(Service)
            .join(Server, Service.server_id == Server.id)
            .join(ServiceDependency, target == Service.id)
            .where(owner == service.id)
            .options(selectinload(Service.server), selectinload(Service.ports))
            .order_by(func.lower(Service.name), Service.id)
        ).all()
        return [ServiceReference(
            id=item.id,
            name=item.name,
            server_name=item.server.name,
            server_ip=str(item.server.ip),
            status=item.status,
            ports=item.ports,
        ) for item in rows]

    result.dependencies = references()
    result.dependents = references(reverse=True)
    return result


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
    q: str | None = Query(None, max_length=200),
    session: Session = Depends(get_session),
) -> Page[ServiceSummary]:
    filters = []
    if q and q.strip():
        filters.append(func.lower(Service.name).contains(q.strip().lower(), autoescape=True))
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
    return _service_read(session, service)


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(payload: ServiceInput, session: Session = Depends(get_session)) -> ServiceRead:
    _lock_dependencies(session)
    _validate_dependencies(session, payload.dependency_ids)
    if session.get(Server, payload.server_id) is None:
        raise HTTPException(status_code=422, detail="server_id does not reference an existing server")
    service = service_from_input(payload)
    session.add(service)
    remember_tags(session, payload.tags)
    remember_service_type(session, payload.service_type)
    session.flush()
    session.add_all(ServiceDependency(service_id=service.id, dependency_id=target) for target in payload.dependency_ids)
    session.commit()
    service = session.scalar(_service_query(service.id))
    if service is None:  # defensive: the just-committed record must exist
        raise HTTPException(status_code=500, detail="Created service could not be loaded")
    return _service_read(session, service)


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(service_id: UUID, payload: ServiceInput, session: Session = Depends(get_session)) -> ServiceRead:
    _lock_dependencies(session)
    service = session.scalar(_service_query(service_id))
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    if session.get(Server, payload.server_id) is None:
        raise HTTPException(status_code=422, detail="server_id does not reference an existing server")
    _validate_dependencies(session, payload.dependency_ids, service_id)
    values = payload.model_dump(exclude={"aliases", "tags", "ports", "commands", "endpoints", "dependency_ids"})
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
    session.execute(delete(ServiceDependency).where(ServiceDependency.service_id == service_id))
    session.add_all(ServiceDependency(service_id=service_id, dependency_id=target) for target in payload.dependency_ids)
    remember_tags(session, payload.tags)
    remember_service_type(session, payload.service_type)
    session.commit()
    service = session.scalar(_service_query(service_id))
    if service is None:
        raise HTTPException(status_code=500, detail="Updated service could not be loaded")
    return _service_read(session, service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: UUID, session: Session = Depends(get_session)) -> None:
    _lock_dependencies(session)
    service = session.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")
    if session.scalar(select(ServiceDependency.service_id).where(
        ServiceDependency.dependency_id == service_id
    ).limit(1)):
        raise HTTPException(status_code=409, detail="Dịch vụ khác đang phụ thuộc vào dịch vụ này. Hãy gỡ quan hệ phụ thuộc trước khi xoá.")
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
