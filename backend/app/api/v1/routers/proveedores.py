from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.api.deps import get_proveedor_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.proveedores import ProveedorCreate, ProveedorRead, ProveedorUpdate
from app.services.proveedor_service import (
    ProveedorDuplicado,
    ProveedorEnUso,
    ProveedorError,
    ProveedorNoEncontrado,
    ProveedorService,
    ProveedorSinCambios,
)

router = APIRouter(
    prefix="/proveedores",
    tags=["Proveedores"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[ProveedorService, Depends(get_proveedor_service)]
ProveedorId = Annotated[str, Path(min_length=1, max_length=20)]
PuedeLeer = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "abastecimiento")),
]
PuedeCrear = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "abastecimiento")),
]
SoloAdministrador = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador")),
]


def _error_http(exc: ProveedorError) -> HTTPException:
    if isinstance(exc, ProveedorNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el proveedor '{exc.args[0]}'",
        )
    if isinstance(exc, (ProveedorDuplicado, ProveedorEnUso)):
        detail = (
            str(exc)
            if isinstance(exc, ProveedorDuplicado)
            else "El proveedor tiene órdenes asociadas y no se puede eliminar"
        )
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    if isinstance(exc, ProveedorSinCambios):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No se enviaron campos para actualizar",
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la operación",
    )


@router.get("", response_model=list[ProveedorRead])
def listar_proveedores(
    service: ServiceDep,
    _: PuedeLeer,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ProveedorRead]:
    return [
        ProveedorRead.model_validate(row)
        for row in service.listar(q, limit, offset)
    ]


@router.get("/{id_proveedor}", response_model=ProveedorRead)
def obtener_proveedor(
    service: ServiceDep,
    id_proveedor: ProveedorId,
    _: PuedeLeer,
) -> ProveedorRead:
    try:
        return ProveedorRead.model_validate(service.obtener(id_proveedor))
    except ProveedorError as exc:
        raise _error_http(exc) from exc


@router.post(
    "",
    response_model=ProveedorRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_proveedor(
    datos: ProveedorCreate,
    service: ServiceDep,
    _: PuedeCrear,
) -> ProveedorRead:
    try:
        return ProveedorRead.model_validate(service.crear(datos))
    except ProveedorError as exc:
        raise _error_http(exc) from exc


@router.patch("/{id_proveedor}", response_model=ProveedorRead)
def actualizar_proveedor(
    datos: ProveedorUpdate,
    service: ServiceDep,
    id_proveedor: ProveedorId,
    _: SoloAdministrador,
) -> ProveedorRead:
    try:
        return ProveedorRead.model_validate(
            service.actualizar(id_proveedor, datos)
        )
    except ProveedorError as exc:
        raise _error_http(exc) from exc


@router.delete("/{id_proveedor}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proveedor(
    service: ServiceDep,
    id_proveedor: ProveedorId,
    _: SoloAdministrador,
) -> Response:
    try:
        service.eliminar(id_proveedor)
    except ProveedorError as exc:
        raise _error_http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
