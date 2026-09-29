from pydantic import Field

from app.schemas.common import Schema
from app.schemas.registry import ServiceSummary


class SearchFilterRead(Schema):
    key: str
    value: str


class SearchItem(ServiceSummary):
    score: float = Field(ge=0)


class SearchResponse(Schema):
    query: str
    filters: list[SearchFilterRead] = Field(default_factory=list)
    items: list[SearchItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    recent: list[ServiceSummary] = Field(default_factory=list)
    frequent: list[ServiceSummary] = Field(default_factory=list)
