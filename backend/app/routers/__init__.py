from fastapi import APIRouter

from app.routers.catalog import router as catalog_router
from app.routers.health import router as health_router
from app.routers.search import router as search_router
from app.routers.servers import router as servers_router
from app.routers.services import router as services_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(servers_router)
api_router.include_router(services_router)
api_router.include_router(catalog_router)
api_router.include_router(search_router)
