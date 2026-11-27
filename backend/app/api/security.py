from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import Connection

from app.core.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.repositories.email_cola_repository import EmailColaRepository
from app.repositories.empresa_repository import EmpresaRepository
from app.services.auth_service import AuthService
from app.services.email_cola_service import EmailColaService

_bearer = HTTPBearer(auto_error=False)


def get_auth_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> AuthService:
    return AuthService(
        AuthRepository(db),
        empresa_repo=EmpresaRepository(db),
        email_queue=EmailColaService(EmailColaRepository(db, "")),
    )


ServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def _usuario_desde_credenciales(
    credentials: HTTPAuthorizationCredentials | None,
    service: AuthService,
) -> dict[str, Any]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        id_empleado = service.decodificar_token(credentials.credentials)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión no es válida o expiró",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    usuario = service.obtener_usuario(id_empleado)
    if usuario is None or not service.token_vigente(
        credentials.credentials, usuario
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión no es válida o expiró",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return usuario


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    service: ServiceDep,
) -> dict[str, Any]:
    return _usuario_desde_credenciales(credentials, service)


def _usuario_opcional(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    service: ServiceDep,
) -> dict[str, Any] | None:
    if credentials is None:
        return None
    return _usuario_desde_credenciales(credentials, service)


def require_roles(*roles: str):
    def check_role(
        usuario: Annotated[dict[str, Any], Depends(get_current_user)],
    ) -> dict[str, Any]:
        if usuario["rol"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para realizar esta operación.",
            )
        return usuario

    return check_role


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
OptionalUser = Annotated[dict[str, Any] | None, Depends(_usuario_opcional)]
