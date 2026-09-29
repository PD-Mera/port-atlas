from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    # Relative to backend/ when run manually; Compose will inject environment.
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_env: Literal["development", "production"] = "production"
    postgres_db: str = Field(default="portatlas", min_length=1)
    postgres_user: str = Field(default="portatlas", min_length=1)
    postgres_password: SecretStr | None = None
    postgres_host: str = Field(default="db", min_length=1)
    postgres_port: int = Field(default=5432, ge=1, le=65535)
    database_url: SecretStr | None = None

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            url = make_url(value.get_secret_value())
            if url.drivername != "postgresql+psycopg":
                raise ValueError("DATABASE_URL must use postgresql+psycopg")
        return value

    def sqlalchemy_url(self) -> URL:
        if self.database_url is not None:
            return make_url(self.database_url.get_secret_value())
        if self.postgres_password is None or not self.postgres_password.get_secret_value():
            raise ValueError("Set POSTGRES_PASSWORD or DATABASE_URL")
        # URL.create handles special characters without string interpolation.
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
