from datetime import UTC, datetime, timedelta

import jwt

from app.api.security import get_auth_service
from app.core.config import get_settings
from app.repositories.empresa_repository import EmpresaRepository


def _token(subject: str) -> str:
    settings = get_settings()
    ahora = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": subject,
            "iat": ahora,
            "exp": ahora + timedelta(minutes=5),
        },
        settings.jwt_secret_key.get_secret_value(),
        algorithm="HS256",
    )


def test_get_auth_service_usa_la_configuracion_y_el_repositorio_de_empresas() -> None:
    service = get_auth_service(None)  # type: ignore[arg-type]

    assert service.decodificar_token(_token("EMP-0001")) == "EMP-0001"
    assert isinstance(service._empresas, EmpresaRepository)
