from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_session
from app.models import Server, Service
from app.schemas.common import Page
from app.schemas.registry import ServerDetailRead, ServerInput, ServerListRead, ServerRead, ServiceSummary

router = APIRouter(prefix="/servers", tags=["servers"])


def _summary(service: Service) -> ServiceSummary:
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


@router.get("", response_model=Page[ServerListRead])
def list_servers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    session: Session = Depends(get_session),
) -> Page[ServerListRead]:
    filters = []
    if q and q.strip():
        value = q.strip().lower()
        filters.append(
            func.lower(Server.name).contains(value, autoescape=True)
            | func.lower(Server.hostname).contains(value, autoescape=True)
            | func.lower(cast(Server.ip, String)).contains(value, autoescape=True)
        )
    base = select(Server).where(*filters)
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    service_count = select(func.count(Service.id)).where(Service.server_id == Server.id).scalar_subquery()
    rows = session.execute(
        select(Server, service_count.label("service_count"))
        .where(*filters)
        .order_by(func.lower(Server.name), Server.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        ServerListRead(**ServerRead.model_validate(server).model_dump(), service_count=count)
        for server, count in rows
    ]
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/{server_id}", response_model=ServerDetailRead)
def get_server(server_id: UUID, session: Session = Depends(get_session)) -> ServerDetailRead:
    server = session.scalar(
        select(Server).where(Server.id == server_id).options(
            selectinload(Server.services).selectinload(Service.server),
            selectinload(Server.services).selectinload(Service.aliases),
            selectinload(Server.services).selectinload(Service.tags),
            selectinload(Server.services).selectinload(Service.ports),
        )
    )
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    base = ServerRead.model_validate(server)
    return ServerDetailRead(**base.model_dump(), services=[_summary(service) for service in server.services])


@router.post("", response_model=ServerRead, status_code=status.HTTP_201_CREATED)
def create_server(payload: ServerInput, session: Session = Depends(get_session)) -> ServerRead:
    server = Server(**payload.model_dump())
    session.add(server)
    session.commit()
    session.refresh(server)
    return ServerRead.model_validate(server)


@router.put("/{server_id}", response_model=ServerRead)
def update_server(server_id: UUID, payload: ServerInput, session: Session = Depends(get_session)) -> ServerRead:
    server = session.get(Server, server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    for field, value in payload.model_dump().items():
        setattr(server, field, value)
    session.commit()
    session.refresh(server)
    return ServerRead.model_validate(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(server_id: UUID, session: Session = Depends(get_session)) -> None:
    server = session.scalar(select(Server).where(Server.id == server_id).options(selectinload(Server.services)))
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if server.services:
        raise HTTPException(status_code=409, detail="Cannot delete a server that still has services")
    session.delete(server)
    session.commit()
