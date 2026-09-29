from app.models import Service, ServiceAlias, ServiceCommand, ServiceEndpoint, ServicePort, ServiceTag
from app.schemas.registry import ServiceInput

NESTED_FIELDS = {"aliases", "tags", "ports", "commands", "endpoints"}


def service_from_input(data: ServiceInput) -> Service:
    """Create an aggregate; the caller owns the session and transaction."""
    service = Service(**data.model_dump(exclude=NESTED_FIELDS))
    service.aliases = [ServiceAlias(alias=alias) for alias in data.aliases]
    service.tags = [ServiceTag(tag=tag) for tag in data.tags]
    service.ports = [ServicePort(**port.model_dump()) for port in data.ports]
    service.commands = [ServiceCommand(**command.model_dump()) for command in data.commands]
    service.endpoints = [ServiceEndpoint(**endpoint.model_dump()) for endpoint in data.endpoints]
    return service
