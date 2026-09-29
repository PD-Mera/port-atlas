from dataclasses import dataclass
import shlex

from sqlalchemy import String, cast, case, exists, func, literal, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.models import Server, Service, ServiceAlias, ServicePort, ServiceTag


ALLOWED_FILTERS = frozenset({"tag", "server", "project", "port"})


class SearchSyntaxError(ValueError):
    """A user query cannot be parsed into the supported search grammar."""


@dataclass(frozen=True)
class SearchFilter:
    key: str
    value: str


@dataclass(frozen=True)
class ParsedQuery:
    terms: tuple[str, ...]
    filters: tuple[SearchFilter, ...]


def parse_query(query: str) -> ParsedQuery:
    if not query.strip():
        return ParsedQuery(terms=(), filters=())
    lexer = shlex.shlex(query, posix=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        tokens = list(lexer)
    except ValueError as exc:
        raise SearchSyntaxError("Dấu ngoặc kép trong truy vấn chưa đóng") from exc
    if len(tokens) > 20:
        raise SearchSyntaxError("Truy vấn chỉ hỗ trợ tối đa 20 token")

    terms: list[str] = []
    filters: list[SearchFilter] = []
    for token in tokens:
        key, separator, value = token.partition(":")
        key = key.lower()
        if separator and key in ALLOWED_FILTERS:
            value = value.strip()
            if not value:
                raise SearchSyntaxError(f"Bộ lọc {key}: cần có giá trị")
            if key == "port" and (not value.isdecimal() or not 1 <= int(value) <= 65535):
                raise SearchSyntaxError("Bộ lọc port: cần là số từ 1 đến 65535")
            filters.append(SearchFilter(key=key, value=value))
        else:
            cleaned = token.strip()
            if cleaned:
                terms.append(cleaned)
    return ParsedQuery(terms=tuple(terms), filters=tuple(filters))


def _escaped_contains(column: ColumnElement, value: str) -> ColumnElement:
    # SQLAlchemy binds the value; autoescape also makes '%' and '_' literal.
    return func.lower(column).contains(value.lower(), autoescape=True)


def _exact(column: ColumnElement, value: str) -> ColumnElement:
    return func.lower(column) == value.lower()


def _prefix(column: ColumnElement, value: str) -> ColumnElement:
    return func.lower(column).startswith(value.lower(), autoescape=True)


def _alias_exists(condition: ColumnElement) -> ColumnElement:
    return exists(select(ServiceAlias.id).where(ServiceAlias.service_id == Service.id, condition))


def _tag_exists(condition: ColumnElement) -> ColumnElement:
    return exists(select(ServiceTag.service_id).where(ServiceTag.service_id == Service.id, condition))


def _port_exists(condition: ColumnElement) -> ColumnElement:
    return exists(select(ServicePort.id).where(ServicePort.service_id == Service.id, condition))


def _server_match(value: str) -> ColumnElement:
    return exists(select(Server.id).where(
        Server.id == Service.server_id,
        or_(
            _escaped_contains(Server.name, value),
            _escaped_contains(Server.hostname, value),
            _escaped_contains(cast(Server.ip, String), value),
        ),
    ))


def _server_exact(value: str) -> ColumnElement:
    return exists(select(Server.id).where(
        Server.id == Service.server_id,
        or_(
            _exact(Server.name, value),
            _exact(Server.hostname, value),
            cast(Server.ip, String) == value,
        ),
    ))


def filter_conditions(filters: tuple[SearchFilter, ...]) -> list[ColumnElement]:
    conditions: list[ColumnElement] = []
    for item in filters:
        if item.key == "tag":
            conditions.append(_tag_exists(_exact(ServiceTag.tag, item.value)))
        elif item.key == "server":
            conditions.append(_server_match(item.value))
        elif item.key == "project":
            conditions.append(_escaped_contains(Service.project, item.value))
        elif item.key == "port":
            conditions.append(_port_exists(ServicePort.port == int(item.value)))
    return conditions


def term_condition(term: str) -> ColumnElement:
    text_match = _escaped_contains(Service.search_text, term)
    vector_match = Service.search_vector.op("@@")(func.plainto_tsquery("simple", term))
    # pg_trgm fuzzy matching helps with small misspellings. Numeric/IP tokens
    # still use substring/vector matching and therefore remain exact enough.
    fuzzy_match = func.similarity(Service.search_text, term.lower()) >= literal(0.22) if len(term) >= 3 else literal(False)
    return or_(text_match, vector_match, fuzzy_match)


def term_rank(term: str) -> ColumnElement:
    exact_name = case((_exact(Service.name, term), literal(100)), else_=literal(0))
    exact_alias = case((_alias_exists(_exact(ServiceAlias.alias, term)), literal(90)), else_=literal(0))
    exact_ip_or_port = case((or_(_server_exact(term), _port_exists(cast(ServicePort.port, String) == term)), literal(80)), else_=literal(0))
    name_prefix = case((_prefix(Service.name, term), literal(70)), else_=literal(0))
    alias_prefix = case((_alias_exists(_prefix(ServiceAlias.alias, term)), literal(60)), else_=literal(0))
    exact_tag = case((_tag_exists(_exact(ServiceTag.tag, term)), literal(40)), else_=literal(0))
    exact_project = case((_exact(Service.project, term), literal(30)), else_=literal(0))
    description_or_notes = case((or_(
        _escaped_contains(Service.description, term),
        _escaped_contains(Service.notes, term),
    ), literal(10)), else_=literal(0))
    fuzzy = func.similarity(Service.search_text, term.lower()) * literal(5) if len(term) >= 3 else literal(0)
    return exact_name + exact_alias + exact_ip_or_port + name_prefix + alias_prefix + exact_tag + exact_project + description_or_notes + fuzzy


def search_score(terms: tuple[str, ...]) -> ColumnElement:
    if not terms:
        return literal(0.0)
    return sum((term_rank(term) for term in terms), literal(0.0))


def build_conditions(parsed: ParsedQuery) -> list[ColumnElement]:
    return [*(term_condition(term) for term in parsed.terms), *filter_conditions(parsed.filters)]
