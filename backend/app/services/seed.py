import argparse

from sqlalchemy import func, select

from app.core.database import get_session_factory
from app.models import Server, Service
from app.schemas.registry import ServerInput, ServiceInput
from app.services.registry import service_from_input
from app.services.tags import remember_tags
from app.services.service_types import remember_service_type


def main() -> None:
    parser = argparse.ArgumentParser(description="Insert optional demo data; never runs on startup")
    parser.add_argument("--apply", action="store_true", help="Confirm insertion of fictitious demo records")
    args = parser.parse_args()
    if not args.apply:
        parser.error("Pass --apply to insert demo data")

    # TEST-NET addresses: examples are not assumed to be real user's servers.
    examples = [
        (ServerInput(name="Demo-241", ip="192.0.2.241", ssh_user="operator", tags=["demo", "gpu"]), [
            {"name": "TTCP-S2T API", "project": "TTCP-S2T", "service_type": "fastapi",
             "aliases": ["s2t", "speech"], "tags": ["demo", "asr", "gpu", "fastapi"],
             "container_name": "ttcp-s2t-api", "compose_path": "/srv/demo/s2t/compose.yaml",
             "ports": [{"name": "HTTP", "port": 4067, "protocol": "http"}],
             "endpoints": [{"name": "API", "url": "http://192.0.2.241:4067"}],
             "commands": [{"name": "Logs", "command_type": "logs", "command": "docker logs --tail 100 ttcp-s2t-api"}]},
        ]),
        (ServerInput(name="Demo-236", ip="192.0.2.236", ssh_user="operator", tags=["demo", "gpu"]), [
            {"name": "Triton", "project": "YOLOR", "aliases": ["triton yolor"], "tags": ["demo", "gpu"],
             "container_name": "demo-triton", "docker_image": "nvcr.io/nvidia/tritonserver",
             "ports": [{"name": "HTTP", "port": 8000, "protocol": "http"},
                       {"name": "gRPC", "port": 8001, "protocol": "grpc"},
                       {"name": "Metrics", "port": 8002, "protocol": "http"}]},
            {"name": "RabbitMQ", "project": "Messaging", "tags": ["demo", "rabbitmq"],
             "management_url": "http://192.0.2.236:15672",
             "ports": [{"name": "AMQP", "port": 5672, "protocol": "amqp"},
                       {"name": "Management", "port": 15672, "protocol": "http"}]},
        ]),
    ]
    created = 0
    with get_session_factory().begin() as session:
        for server_data, services in examples:
            server = session.scalar(select(Server).where(func.lower(Server.name) == server_data.name.lower()))
            if server is None:
                server = Server(**server_data.model_dump())
                session.add(server)
                session.flush()
            remember_tags(session, server.tags)
            for values in services:
                existing = session.scalar(select(Service.id).where(
                    Service.server_id == server.id, func.lower(Service.name) == values["name"].lower()
                ))
                if existing is not None:
                    continue  # Never overwrite user edits to existing records.
                data = ServiceInput(server_id=server.id, environment="demo", status="unknown", **values)
                session.add(service_from_input(data))
                remember_tags(session, data.tags)
                remember_service_type(session, data.service_type)
                session.flush()
                created += 1
    print(f"Inserted {created} demo services; existing records were preserved")


if __name__ == "__main__":
    main()
