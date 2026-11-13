from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.api.deps import get_presupuesto_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.pedidos_venta import PedidoVentaRead
from app.schemas.presupuestos import (
    PresupuestoConversionInput,
    PresupuestoInput,
    PresupuestoRead,
)
from app.services.presupuesto_service import (
    PresupuestoDatosInvalidos,
    PresupuestoError,
    PresupuestoEstadoInvalido,
    PresupuestoNoEncontrado,
    PresupuestoService,
    PresupuestoStockInsuficiente,
)

router = APIRouter(
    prefix="/ventas/presupuestos",
    tags=["Presupuestos"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[PresupuestoService, Depends(get_presupuesto_service)]
PresupuestoId = Annotated[str, Path(min_length=1, max_length=20)]
PuedeLeer = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]
PuedeGestionar = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]


def _error_http(exc: PresupuestoError) -> HTTPException:
    if isinstance(exc, PresupuestoNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el presupuesto '{exc.args[0]}'",
        )
    if isinstance(
        exc,
        (PresupuestoEstadoInvalido, PresupuestoStockInsuficiente),
    ):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, PresupuestoDatosInvalidos):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar el presupuesto",
    )


@router.get("", response_model=list[PresupuestoRead])
def listar_presupuestos(
    service: ServiceDep,
    _: PuedeLeer,
    estado: Annotated[
        Literal["pendiente", "aprobado", "vencido", "convertido"] | None,
        Query(),
    ] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PresupuestoRead]:
    return [
        PresupuestoRead.model_validate(item)
        for item in service.listar(estado, q, limit, offset)
    ]


@router.get("/{id_presupuesto_cliente}", response_model=PresupuestoRead)
def obtener_presupuesto(
    service: ServiceDep,
    id_presupuesto_cliente: PresupuestoId,
    _: PuedeLeer,
) -> PresupuestoRead:
    try:
        return PresupuestoRead.model_validate(
            service.obtener(id_presupuesto_cliente)
        )
    except PresupuestoError as exc:
        raise _error_http(exc) from exc


@router.post(
    "",
    response_model=PresupuestoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_presupuesto(
    datos: PresupuestoInput,
    service: ServiceDep,
    _: PuedeGestionar,
) -> PresupuestoRead:
    try:
        return PresupuestoRead.model_validate(service.crear(datos))
    except PresupuestoError as exc:
        raise _error_http(exc) from exc


@router.put(
    "/{id_presupuesto_cliente}",
    response_model=PresupuestoRead,
)
def actualizar_presupuesto(
    datos: PresupuestoInput,
    service: ServiceDep,
    id_presupuesto_cliente: PresupuestoId,
    _: PuedeGestionar,
) -> PresupuestoRead:
    try:
        return PresupuestoRead.model_validate(
            service.actualizar(id_presupuesto_cliente, datos)
        )
    except PresupuestoError as exc:
        raise _error_http(exc) from exc


@router.delete(
    "/{id_presupuesto_cliente}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def eliminar_presupuesto(
    service: ServiceDep,
    id_presupuesto_cliente: PresupuestoId,
    _: PuedeGestionar,
) -> Response:
    try:
        service.eliminar(id_presupuesto_cliente)
    except PresupuestoError as exc:
        raise _error_http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{id_presupuesto_cliente}/aprobacion",
    response_model=PresupuestoRead,
)
def aprobar_presupuesto(
    service: ServiceDep,
    id_presupuesto_cliente: PresupuestoId,
    _: PuedeGestionar,
) -> PresupuestoRead:
    try:
        return PresupuestoRead.model_validate(
            service.aprobar(id_presupuesto_cliente)
        )
    except PresupuestoError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/{id_presupuesto_cliente}/conversion",
    response_model=PedidoVentaRead,
    status_code=status.HTTP_201_CREATED,
)
def convertir_presupuesto(
    datos: PresupuestoConversionInput,
    service: ServiceDep,
    id_presupuesto_cliente: PresupuestoId,
    _: PuedeGestionar,
) -> PedidoVentaRead:
    try:
        return PedidoVentaRead.model_validate(
            service.convertir(id_presupuesto_cliente, datos)
        )
    except PresupuestoError as exc:
        raise _error_http(exc) from exc
