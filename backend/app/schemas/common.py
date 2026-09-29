from datetime import datetime
from typing import Annotated, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True, extra="forbid")


class Record(Schema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class Pagination(Schema):
    page: Annotated[int, Field(ge=1)] = 1
    page_size: Annotated[int, Field(ge=1, le=100)] = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


Item = TypeVar("Item")


class Page(Schema, Generic[Item]):
    items: list[Item]
    total: int
    page: int
    page_size: int


class CatalogItem(Schema):
    value: str
    count: int


class AccessRead(Schema):
    id: UUID
    last_accessed_at: datetime
    access_count: int


class ErrorDetail(Schema):
    field: str
    message: str


class ErrorBody(Schema):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(Schema):
    error: ErrorBody
