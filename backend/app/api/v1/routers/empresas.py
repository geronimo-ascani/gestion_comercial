from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.deps import get_empresa_service
from app.api.security import CurrentUser, get_current_user, require_roles
from app.schemas.empresas import EmpresaRead, EmpresaUpdate
from app.services.empresa_service import (
    EmpresaDatosInvalidos,
    EmpresaDuplicada,
    EmpresaError,
    EmpresaNoEncontrada,
    EmpresaService,
)

router = APIRouter(
    prefix="/empresas",
    tags=["Empresas"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[EmpresaService, Depends(get_empresa_service)]
EmpresaId = Annotated[str, Path(min_length=1, max_length=20)]
SoloAdministrador = Annotated[
    dict,
    Depends(require_roles("administrador")),
]


def _error_http(exc: EmpresaError) -> HTTPException:
    if isinstance(exc, EmpresaNoEncontrada):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe la empresa '{exc.args[0]}'",
        )
    if isinstance(exc, EmpresaDuplicada):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, EmpresaDatosInvalidos):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la empresa",
    )


@router.get("", response_model=list[EmpresaRead])
def listar_empresas(
    service: ServiceDep,
    usuario: SoloAdministrador,
) -> list[EmpresaRead]:
    try:
        return [
            EmpresaRead.model_validate(
                service.obtener_actual(usuario["id_empresa"])
            )
        ]
    except EmpresaError as exc:
        raise _error_http(exc) from exc


@router.get("/actual", response_model=EmpresaRead)
def obtener_empresa_actual(
    service: ServiceDep,
    usuario: CurrentUser,
) -> EmpresaRead:
    try:
        return EmpresaRead.model_validate(
            service.obtener_actual(usuario["id_empresa"])
        )
    except EmpresaError as exc:
        raise _error_http(exc) from exc


@router.put("/{id_empresa}", response_model=EmpresaRead)
def actualizar_empresa(
    datos: EmpresaUpdate,
    service: ServiceDep,
    id_empresa: EmpresaId,
    usuario: SoloAdministrador,
) -> EmpresaRead:
    if id_empresa != usuario["id_empresa"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe la empresa '{id_empresa}'",
        )
    try:
        return EmpresaRead.model_validate(
            service.actualizar(id_empresa, datos)
        )
    except EmpresaError as exc:
        raise _error_http(exc) from exc
