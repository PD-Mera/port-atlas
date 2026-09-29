from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import get_engine
from app.core.errors import register_error_handlers
from app.routers import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No create_all, migrations, seed or remote healthchecks on app startup.
    yield
    if get_engine.cache_info().currsize:
        get_engine().dispose()


app = FastAPI(title="PortAtlas API", version="0.1.0", lifespan=lifespan)
register_error_handlers(app)
app.include_router(api_router, prefix="/api")
