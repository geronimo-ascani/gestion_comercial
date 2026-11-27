from datetime import date
from typing import Annotated, Any, Literal
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError

from app.api.deps import get_factura_proveedor_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.facturas_proveedor import (
    FacturaProveedorCreate,
    FacturaProveedorRead,
    FacturaProveedorResumen,
    PagoProveedorCreate,
    PagoProveedorRead,
)
from app.schemas.reportes_cobros_pagos import PagoProveedorListadoRead
from app.schemas.pagos import PagoEstadoUpdate
from app.services.factura_proveedor_service import (
    MAX_ARCHIVO_BYTES,
    FacturaProveedorDatosInvalidos,
    FacturaProveedorDuplicada,
    FacturaProveedorError,
    FacturaProveedorNoEncontrado,
    FacturaProveedorService,
    PagoFacturaDatosInvalidos,
)

router = APIRouter(
    prefix="/compras",
    tags=["Facturas de proveedores"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[
    FacturaProveedorService, Depends(get_factura_proveedor_service)
]
Id = Annotated[str, Path(min_length=1, max_length=20)]
PuedeGestionar = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador", "abastecimiento")),
]
SoloAdmin = Annotated[
    dict[str, Any],
    Depends(require_roles("administrador")),
]


def _error_http(exc: FacturaProveedorError) -> HTTPException:
    if isinstance(exc, FacturaProveedorNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    if isinstance(exc, (FacturaProveedorDuplicada, PagoFacturaDatosInvalidos)):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    if isinstance(exc, FacturaProveedorDatosInvalidos):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la factura del proveedor",
    )


@router.get("/facturas", response_model=list[FacturaProveedorResumen])
def listar_facturas(
    service: ServiceDep,
    _: PuedeGestionar,
    estado_pago: Annotated[
        Literal["emitida", "pagada"] | None,
        Query(),
    ] = None,
    id_pedido_proveedor: Annotated[str | None, Query(max_length=20)] = None,
    id_proveedor: Annotated[str | None, Query(max_length=20)] = None,
    q: Annotated[str | None, Query(max_length=160)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[FacturaProveedorResumen]:
    return [
        FacturaProveedorResumen.model_validate(factura)
        for factura in service.listar(
            estado_pago,
            id_pedido_proveedor,
            id_proveedor,
            q,
            limit,
            offset,
        )
    ]


@router.get("/pagos", response_model=list[PagoProveedorListadoRead])
def listar_pagos_a_proveedores(
    service: ServiceDep,
    _: SoloAdmin,
    desde: Annotated[date | None, Query()] = None,
    hasta: Annotated[date | None, Query()] = None,
    id_proveedor: Annotated[str | None, Query(max_length=20)] = None,
    estado: Annotated[
        Literal["aprobado", "pendiente", "rechazado"] | None, Query()
    ] = None,
    id_medio_pago: Annotated[str | None, Query(max_length=20)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PagoProveedorListadoRead]:
    """RF-20: listado global de pagos a proveedor, solo administrador."""
    try:
        pagos = service.listar_pagos_globales(
            desde,
            hasta,
            id_proveedor,
            estado,
            id_medio_pago,
            limit,
            offset,
        )
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc
    return [
        PagoProveedorListadoRead.model_validate(pago) for pago in pagos
    ]


@router.post(
    "/facturas",
    response_model=FacturaProveedorRead,
    status_code=status.HTTP_201_CREATED,
)
async def crear_factura(
    metadata: Annotated[str, Form()],
    archivo: Annotated[UploadFile, File()],
    service: ServiceDep,
    usuario: PuedeGestionar,
) -> FacturaProveedorRead:
    try:
        datos = FacturaProveedorCreate.model_validate_json(metadata)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=jsonable_encoder(exc.errors()),
        ) from exc

    try:
        contenido = await archivo.read(MAX_ARCHIVO_BYTES + 1)
    finally:
        await archivo.close()

    try:
        return FacturaProveedorRead.model_validate(
            service.crear(
                datos,
                usuario["id_empleado"],
                {
                    "nombre": archivo.filename or "",
                    "mime_type": archivo.content_type or "",
                    "contenido": contenido,
                },
            )
        )
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc


@router.get(
    "/facturas/{id_factura}/archivo",
    responses={
        200: {"content": {"application/pdf": {}, "image/jpeg": {}}},
    },
)
def descargar_archivo_factura(
    service: ServiceDep,
    id_factura: Id,
    _: PuedeGestionar,
) -> Response:
    """Devuelve el PDF/JPG original, embebido para poder visualizarlo."""
    try:
        archivo = service.obtener_archivo(id_factura)
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc

    nombre = archivo["nombre_archivo"]
    return Response(
        content=archivo["contenido"],
        media_type=archivo["mime_type"],
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(nombre)}"
        },
    )


@router.get("/facturas/{id_factura}", response_model=FacturaProveedorRead)
def obtener_factura(
    service: ServiceDep,
    id_factura: Id,
    _: PuedeGestionar,
) -> FacturaProveedorRead:
    try:
        return FacturaProveedorRead.model_validate(
            service.obtener(id_factura)
        )
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc


@router.get(
    "/pedidos/{id_pedido_proveedor}/facturas",
    response_model=list[FacturaProveedorResumen],
)
def listar_facturas_del_pedido(
    service: ServiceDep,
    id_pedido_proveedor: Id,
    _: PuedeGestionar,
) -> list[FacturaProveedorResumen]:
    return [
        FacturaProveedorResumen.model_validate(factura)
        for factura in service.listar_por_pedido(id_pedido_proveedor)
    ]


@router.get(
    "/facturas/{id_factura}/pagos",
    response_model=list[PagoProveedorRead],
)
def listar_pagos_de_factura(
    service: ServiceDep,
    id_factura: Id,
    _: PuedeGestionar,
) -> list[PagoProveedorRead]:
    try:
        return [
            PagoProveedorRead.model_validate(pago)
            for pago in service.listar_pagos(id_factura)
        ]
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc


@router.post(
    "/facturas/{id_factura}/pagos",
    response_model=PagoProveedorRead,
    status_code=status.HTTP_201_CREATED,
)
def registrar_pago_de_factura(
    datos: PagoProveedorCreate,
    service: ServiceDep,
    id_factura: Id,
    _: PuedeGestionar,
) -> PagoProveedorRead:
    try:
        return PagoProveedorRead.model_validate(
            service.registrar_pago(id_factura, datos)
        )
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc


@router.patch(
    "/facturas/{id_factura}/pagos/{id_pago}",
    response_model=PagoProveedorRead,
)
def cambiar_estado_pago_de_factura(
    datos: PagoEstadoUpdate,
    service: ServiceDep,
    id_factura: Id,
    id_pago: Id,
    _: PuedeGestionar,
) -> PagoProveedorRead:
    try:
        return PagoProveedorRead.model_validate(
            service.cambiar_estado_pago(id_factura, id_pago, datos)
        )
    except FacturaProveedorError as exc:
        raise _error_http(exc) from exc
