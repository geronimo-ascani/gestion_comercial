from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    jwt_secret_key: SecretStr
    jwt_access_token_minutes: int = Field(default=60, gt=0, le=1440)
    password_reset_token_minutes: int = Field(default=30, gt=0, le=1440)
    data_encryption_key: str = ""
    frontend_base_url: str = "http://localhost:5173"
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_sender: str | None = None
    smtp_starttls: bool = True
    smtp_use_ssl: bool = False
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("jwt_secret_key")
    @classmethod
    def validar_jwt_secret_key(cls, valor: SecretStr) -> SecretStr:
        if len(valor.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY debe tener al menos 32 caracteres")
        return valor

    @field_validator("database_url")
    @classmethod
    def normalizar_database_url(cls, valor: str) -> str:
        return valor.replace("postgresql+psycopg://", "postgresql://", 1)


@lru_cache
def get_settings() -> Settings:
    return Settings()
