from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import get_pedido_venta_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.pedidos_venta import (
    PedidoVentaEstadoInput,
    PedidoVentaInput,
    PedidoVentaRead,
)
from app.services.pedido_venta_service import (
    PedidoVentaDatosInvalidos,
    PedidoVentaError,
    PedidoVentaEstadoInvalido,
    PedidoVentaNoEncontrado,
    PedidoVentaService,
    PedidoVentaStockInsuficiente,
)

router = APIRouter(
    prefix="/ventas/pedidos",
    tags=["Pedidos de venta"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[PedidoVentaService, Depends(get_pedido_venta_service)]
PedidoId = Annotated[str, Path(min_length=1, max_length=20)]
PuedeLeer = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]
PuedeGestionar = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]


def _error_http(exc: PedidoVentaError) -> HTTPException:
    if isinstance(exc, PedidoVentaNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el pedido de venta '{exc.args[0]}'",
        )
    if isinstance(exc, (PedidoVentaEstadoInvalido, PedidoVentaStockInsuficiente)):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, PedidoVentaDatosInvalidos):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar el pedido de venta",
    )


@router.get("", response_model=list[PedidoVentaRead])
def listar_pedidos_venta(
    service: ServiceDep,
    _: PuedeLeer,
    estado_envio: Annotated[
        Literal["pendiente", "proceso", "enviado", "entregado", "cancelado"] | None,
        Query(),
    ] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PedidoVentaRead]:
    return [
        PedidoVentaRead.model_validate(row)
        for row in service.listar(estado_envio, q, limit, offset)
    ]


@router.get("/{id_pedido_cliente}", response_model=PedidoVentaRead)
def obtener_pedido_venta(
    service: ServiceDep,
    id_pedido_cliente: PedidoId,
    _: PuedeLeer,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(
            service.obtener(id_pedido_cliente)
        )
    except PedidoVentaError as exc:
        raise _error_http(exc) from exc


@router.post(
    "",
    response_model=PedidoVentaRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_pedido_venta(
    datos: PedidoVentaInput,
    service: ServiceDep,
    _: PuedeGestionar,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(service.crear(datos))
    except PedidoVentaError as exc:
        raise _error_http(exc) from exc


@router.put("/{id_pedido_cliente}", response_model=PedidoVentaRead)
def actualizar_pedido_venta(
    datos: PedidoVentaInput,
    service: ServiceDep,
    id_pedido_cliente: PedidoId,
    _: PuedeGestionar,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(
            service.actualizar(id_pedido_cliente, datos)
        )
    except PedidoVentaError as exc:
        raise _error_http(exc) from exc


@router.patch(
    "/{id_pedido_cliente}/estado",
    response_model=PedidoVentaRead,
)
def avanzar_estado_pedido_venta(
    datos: PedidoVentaEstadoInput,
    service: ServiceDep,
    id_pedido_cliente: PedidoId,
    _: PuedeGestionar,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(
            service.avanzar_estado(id_pedido_cliente, datos.estado_envio)
        )
    except PedidoVentaError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/{id_pedido_cliente}/cancelacion",
    response_model=PedidoVentaRead,
)
def cancelar_pedido_venta(
    service: ServiceDep,
    id_pedido_cliente: PedidoId,
    _: PuedeGestionar,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(
            service.cancelar(id_pedido_cliente)
        )
    except PedidoVentaError as exc:
        raise _error_http(exc) from exc
