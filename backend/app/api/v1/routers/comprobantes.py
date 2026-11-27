from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import get_comprobante_service, get_pago_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.comprobantes import (
    ComprobanteEnvioInput,
    ComprobanteVentaCreate,
    ComprobanteVentaRead,
    ComprobanteVentaResumen,
)
from app.schemas.pagos import (
    CobroCreate,
    ComprobanteEnvioRead,
    PagoListadoRead,
    PagoRead,
)
from app.services.comprobante_service import (
    ComprobanteDatosInvalidos,
    ComprobanteEmpresaNoConfigurada,
    ComprobanteEnvioFallido,
    ComprobanteEnvioNoConfigurado,
    ComprobanteEnvioSinDestinatario,
    ComprobanteError,
    ComprobanteEstadoInvalido,
    ComprobanteNoEncontrado,
    ComprobanteService,
)
from app.services.pago_service import (
    PagoDatosInvalidos,
    PagoError,
    PagoEstadoInvalido,
    PagoService,
)

router = APIRouter(
    prefix="/ventas",
    tags=["Comprobantes de venta"],
    dependencies=[Depends(get_current_user)],
)

ComprobanteDep = Annotated[
    ComprobanteService, Depends(get_comprobante_service)
]
PagoDep = Annotated[PagoService, Depends(get_pago_service)]
Id = Annotated[str, Path(min_length=1, max_length=20)]
Usuario = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "ventas")),
]


def _error_http(exc: Exception) -> HTTPException:
    if isinstance(exc, (ComprobanteNoEncontrado,)):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc.args[0]) if exc.args else "No encontrado",
        )
    if isinstance(
        exc,
        (
            ComprobanteEstadoInvalido,
            ComprobanteEmpresaNoConfigurada,
            ComprobanteEnvioSinDestinatario,
            ComprobanteEnvioNoConfigurado,
            PagoEstadoInvalido,
            PagoDatosInvalidos,
        ),
    ):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, ComprobanteEnvioFallido):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    if isinstance(exc, (ComprobanteDatosInvalidos,)):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    if isinstance(exc, PagoError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    if isinstance(exc, ComprobanteError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar el comprobante",
    )


@router.post(
    "/pedidos/{id_pedido_cliente}/comprobante",
    response_model=ComprobanteVentaRead,
)
def emitir_comprobante(
    service: ComprobanteDep,
    id_pedido_cliente: Id,
    usuario: Usuario,
    datos: ComprobanteVentaCreate | None = None,
) -> ComprobanteVentaRead:
    try:
        return ComprobanteVentaRead.model_validate(
            service.emitir(
                id_pedido_cliente,
                datos or ComprobanteVentaCreate(),
                usuario["id_empleado"],
            )
        )
    except ComprobanteError as exc:
        raise _error_http(exc) from exc


@router.get(
    "/pedidos/{id_pedido_cliente}/comprobante",
    response_model=ComprobanteVentaRead,
)
def obtener_comprobante_de_pedido(
    service: ComprobanteDep,
    id_pedido_cliente: Id,
    _: Usuario,
) -> ComprobanteVentaRead:
    try:
        return ComprobanteVentaRead.model_validate(
            service.obtener_por_pedido(id_pedido_cliente)
        )
    except ComprobanteError as exc:
        raise _error_http(exc) from exc


@router.get("/comprobantes", response_model=list[ComprobanteVentaResumen])
def listar_comprobantes(
    service: ComprobanteDep,
    _: Usuario,
    estado_pago: Annotated[
        Literal["emitida", "aprobada", "pagada", "rechazada"] | None,
        Query(),
    ] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ComprobanteVentaResumen]:
    return [
        ComprobanteVentaResumen.model_validate(row)
        for row in service.listar(estado_pago, q, limit, offset)
    ]


@router.get(
    "/comprobantes/{id_comprobante_venta}",
    response_model=ComprobanteVentaRead,
)
def obtener_comprobante(
    service: ComprobanteDep,
    id_comprobante_venta: Id,
    _: Usuario,
) -> ComprobanteVentaRead:
    try:
        return ComprobanteVentaRead.model_validate(
            service.obtener(id_comprobante_venta)
        )
    except ComprobanteError as exc:
        raise _error_http(exc) from exc


@router.get("/pagos", response_model=list[PagoListadoRead])
def listar_todos_los_pagos(
    service: PagoDep,
    _: Usuario,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PagoListadoRead]:
    return [
        PagoListadoRead.model_validate(pago)
        for pago in service.listar_todos(limit, offset)
    ]


@router.get(
    "/comprobantes/{id_comprobante_venta}/pagos",
    response_model=list[PagoRead],
)
def listar_pagos(
    service: PagoDep,
    id_comprobante_venta: Id,
    _: Usuario,
) -> list[PagoRead]:
    try:
        return [
            PagoRead.model_validate(pago)
            for pago in service.listar(id_comprobante_venta)
        ]
    except ComprobanteError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/comprobantes/{id_comprobante_venta}/pagos",
    response_model=PagoRead,
    status_code=status.HTTP_201_CREATED,
)
def registrar_pago(
    datos: CobroCreate,
    service: PagoDep,
    id_comprobante_venta: Id,
    _: Usuario,
) -> PagoRead:
    try:
        return PagoRead.model_validate(
            service.registrar(id_comprobante_venta, datos)
        )
    except (ComprobanteError, PagoError) as exc:
        raise _error_http(exc) from exc


@router.get(
    "/comprobantes/{id_comprobante_venta}/envios",
    response_model=list[ComprobanteEnvioRead],
)
def listar_envios(
    service: ComprobanteDep,
    id_comprobante_venta: Id,
    _: Usuario,
) -> list[ComprobanteEnvioRead]:
    try:
        return [
            ComprobanteEnvioRead.model_validate(envio)
            for envio in service.listar_envios(id_comprobante_venta)
        ]
    except ComprobanteError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/comprobantes/{id_comprobante_venta}/envio",
    response_model=ComprobanteEnvioRead,
)
def enviar_comprobante(
    service: ComprobanteDep,
    id_comprobante_venta: Id,
    _: Usuario,
    datos: ComprobanteEnvioInput | None = None,
) -> ComprobanteEnvioRead:
    solicitud = datos or ComprobanteEnvioInput()
    try:
        return ComprobanteEnvioRead.model_validate(
            service.enviar(
                id_comprobante_venta,
                solicitud.destinatario,
                solicitud.cc,
                solicitud.bcc,
            )
        )
    except ComprobanteError as exc:
        raise _error_http(exc) from exc
