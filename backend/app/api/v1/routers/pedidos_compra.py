from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import get_pedido_compra_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.pedidos_compra import PedidoCompraCreate, PedidoCompraRead
from app.services.pedido_compra_service import (
    PedidoCompraDatosInvalidos,
    PedidoCompraError,
    PedidoCompraEstadoInvalido,
    PedidoCompraNoEncontrado,
    PedidoCompraService,
)

router = APIRouter(
    prefix="/compras/pedidos",
    tags=["Pedidos de compra"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[PedidoCompraService, Depends(get_pedido_compra_service)]
PedidoId = Annotated[str, Path(min_length=1, max_length=20)]
PuedeLeer = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "abastecimiento")),
]
PuedeCrear = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "abastecimiento")),
]


def _error_http(exc: PedidoCompraError) -> HTTPException:
    if isinstance(exc, PedidoCompraNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el pedido de compra '{exc.args[0]}'",
        )
    if isinstance(exc, PedidoCompraEstadoInvalido):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, PedidoCompraDatosInvalidos):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar el pedido de compra",
    )


@router.get("", response_model=list[PedidoCompraRead])
def listar_pedidos_compra(
    service: ServiceDep,
    _: PuedeLeer,
    estado: Annotated[
        Literal["pendiente", "aprobada", "recibida", "cancelada"] | None,
        Query(),
    ] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PedidoCompraRead]:
    return [
        PedidoCompraRead.model_validate(row)
        for row in service.listar(estado, q, limit, offset)
    ]


@router.get("/{id_pedido_proveedor}", response_model=PedidoCompraRead)
def obtener_pedido_compra(
    service: ServiceDep,
    id_pedido_proveedor: PedidoId,
    _: PuedeLeer,
) -> PedidoCompraRead:
    try:
        return PedidoCompraRead.model_validate(
            service.obtener(id_pedido_proveedor)
        )
    except PedidoCompraError as exc:
        raise _error_http(exc) from exc


@router.post(
    "",
    response_model=PedidoCompraRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_pedido_compra(
    datos: PedidoCompraCreate,
    service: ServiceDep,
    usuario: PuedeCrear,
) -> PedidoCompraRead:
    try:
        return PedidoCompraRead.model_validate(
            service.crear(datos, usuario["id_empleado"])
        )
    except PedidoCompraError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/{id_pedido_proveedor}/recepcion",
    response_model=PedidoCompraRead,
)
def recibir_pedido_compra(
    service: ServiceDep,
    id_pedido_proveedor: PedidoId,
    _: PuedeCrear,
) -> PedidoCompraRead:
    try:
        return PedidoCompraRead.model_validate(
            service.recibir(id_pedido_proveedor)
        )
    except PedidoCompraError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/{id_pedido_proveedor}/cancelacion",
    response_model=PedidoCompraRead,
)
def cancelar_pedido_compra(
    service: ServiceDep,
    id_pedido_proveedor: PedidoId,
    _: PuedeCrear,
) -> PedidoCompraRead:
    try:
        return PedidoCompraRead.model_validate(
            service.cancelar(id_pedido_proveedor)
        )
    except PedidoCompraError as exc:
        raise _error_http(exc) from exc
