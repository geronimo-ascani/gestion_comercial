from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.api.deps import get_cliente_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.clientes import ClienteCreate, ClienteRead, ClienteUpdate
from app.services.cliente_service import (
    ClienteDatosInvalidos,
    ClienteDuplicado,
    ClienteEnUso,
    ClienteError,
    ClienteNoEncontrado,
    ClienteService,
    ClienteSinCambios,
)

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[ClienteService, Depends(get_cliente_service)]
ClienteId = Annotated[str, Path(min_length=1, max_length=20)]
PuedeLeer = Annotated[dict[str, Any], Depends(require_roles("administrador", "ventas"))]
PuedeCrear = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]
SoloAdministrador = Annotated[dict[str, Any], Depends(require_roles("administrador"))]


def _error_http(exc: ClienteError) -> HTTPException:
    if isinstance(exc, ClienteNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el cliente '{exc.args[0]}'",
        )
    if isinstance(exc, (ClienteDuplicado, ClienteEnUso)):
        detail = (
            str(exc)
            if isinstance(exc, ClienteDuplicado)
            else "El cliente tiene operaciones asociadas y no se puede eliminar"
        )
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    if isinstance(exc, (ClienteDatosInvalidos, ClienteSinCambios)):
        detail = (
            str(exc)
            if isinstance(exc, ClienteDatosInvalidos)
            else "No se enviaron campos para actualizar"
        )
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=detail,
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la operación",
    )


@router.get("", response_model=list[ClienteRead])
def listar_clientes(
    service: ServiceDep,
    _: PuedeLeer,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ClienteRead]:
    return [
        ClienteRead.model_validate(row)
        for row in service.listar(q, limit, offset)
    ]


@router.get("/{id_cliente}", response_model=ClienteRead)
def obtener_cliente(
    service: ServiceDep,
    id_cliente: ClienteId,
    _: PuedeLeer,
) -> ClienteRead:
    try:
        return ClienteRead.model_validate(service.obtener(id_cliente))
    except ClienteError as exc:
        raise _error_http(exc) from exc


@router.post(
    "",
    response_model=ClienteRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_cliente(
    datos: ClienteCreate,
    service: ServiceDep,
    _: PuedeCrear,
) -> ClienteRead:
    try:
        return ClienteRead.model_validate(service.crear(datos))
    except ClienteError as exc:
        raise _error_http(exc) from exc


@router.patch("/{id_cliente}", response_model=ClienteRead)
def actualizar_cliente(
    datos: ClienteUpdate,
    service: ServiceDep,
    id_cliente: ClienteId,
    _: SoloAdministrador,
) -> ClienteRead:
    try:
        return ClienteRead.model_validate(service.actualizar(id_cliente, datos))
    except ClienteError as exc:
        raise _error_http(exc) from exc


@router.delete("/{id_cliente}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cliente(
    service: ServiceDep,
    id_cliente: ClienteId,
    _: SoloAdministrador,
) -> Response:
    try:
        service.eliminar(id_cliente)
    except ClienteError as exc:
        raise _error_http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
