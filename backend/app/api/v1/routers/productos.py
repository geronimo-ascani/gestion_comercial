from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.api.deps import get_producto_service
from app.schemas.catalogo import (
    ProductoAjusteStock,
    ProductoCreate,
    ProductoListResponse,
    ProductoRead,
    ProductoUpdate,
)
from app.schemas.inventario import MovimientoInventarioRead
from app.services.producto_service import (
    ProductoDatosInvalidos,
    ProductoEnUso,
    ProductoError,
    ProductoNoEncontrado,
    ProductoService,
    ProductoSinCambios,
    ProductoStockInsuficiente,
)

router = APIRouter(prefix="/productos", tags=["Productos"])

ServiceDep = Annotated[ProductoService, Depends(get_producto_service)]
ProductoId = Annotated[str, Path(min_length=1, max_length=20)]


def _error_http(exc: ProductoError) -> HTTPException:
    if isinstance(exc, ProductoNoEncontrado):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe el producto '{exc.args[0]}'",
        )
    if isinstance(exc, ProductoEnUso):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El producto tiene referencias asociadas y no se puede eliminar",
        )
    if isinstance(exc, ProductoStockInsuficiente):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El stock actual no alcanza para realizar la salida",
        )
    if isinstance(exc, ProductoSinCambios):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No se enviaron campos para actualizar",
        )
    if isinstance(exc, ProductoDatosInvalidos):
        detalle = exc.args[0] if exc.args else "Los datos del producto no son válidos"
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=detalle,
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la operación",
    )


@router.get("", response_model=ProductoListResponse)
def listar_productos(
    service: ServiceDep,
    q: Annotated[str | None, Query(max_length=160)] = None,
    id_categoria: Annotated[str | None, Query(max_length=20)] = None,
    id_alicuota_iva: Annotated[str | None, Query(max_length=20)] = None,
    id_unidad: Annotated[str | None, Query(max_length=20)] = None,
    precio_min: Annotated[Decimal | None, Query(ge=0)] = None,
    precio_max: Annotated[Decimal | None, Query(ge=0)] = None,
    stock_estado: Annotated[
        Literal["todos", "en_stock", "critico", "sin_stock"], Query()
    ] = "todos",
    estado: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProductoListResponse:
    try:
        productos, total = service.listar(
            q,
            id_categoria,
            id_alicuota_iva,
            id_unidad,
            precio_min,
            precio_max,
            stock_estado,
            estado,
            limit,
            offset,
        )
    except ProductoError as exc:
        raise _error_http(exc) from exc

    return ProductoListResponse(
        items=[ProductoRead.model_validate(producto) for producto in productos],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/alertas-stock", response_model=ProductoListResponse)
def listar_alertas_stock(
    service: ServiceDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProductoListResponse:
    productos, total = service.alertas_stock(limit, offset)
    return ProductoListResponse(
        items=[ProductoRead.model_validate(producto) for producto in productos],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_producto}", response_model=ProductoRead)
def obtener_producto(service: ServiceDep, id_producto: ProductoId) -> ProductoRead:
    try:
        producto = service.obtener(id_producto)
    except ProductoError as exc:
        raise _error_http(exc) from exc
    return ProductoRead.model_validate(producto)


@router.post("", response_model=ProductoRead, status_code=status.HTTP_201_CREATED)
def crear_producto(datos: ProductoCreate, service: ServiceDep) -> ProductoRead:
    try:
        producto = service.crear(datos)
    except ProductoError as exc:
        raise _error_http(exc) from exc
    return ProductoRead.model_validate(producto)


@router.patch("/{id_producto}", response_model=ProductoRead)
def actualizar_producto(
    datos: ProductoUpdate,
    service: ServiceDep,
    id_producto: ProductoId,
) -> ProductoRead:
    try:
        producto = service.actualizar(id_producto, datos)
    except ProductoError as exc:
        raise _error_http(exc) from exc
    return ProductoRead.model_validate(producto)


@router.delete("/{id_producto}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(
    service: ServiceDep,
    id_producto: ProductoId,
    definitivo: Annotated[bool, Query()] = False,
) -> Response:
    try:
        service.eliminar(id_producto, definitivo)
    except ProductoError as exc:
        raise _error_http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{id_producto}/movimientos",
    response_model=list[MovimientoInventarioRead],
)
def listar_movimientos(
    service: ServiceDep,
    id_producto: ProductoId,
    desde: Annotated[datetime | None, Query()] = None,
    hasta: Annotated[datetime | None, Query()] = None,
    tipo: Annotated[Literal["entrada", "salida"] | None, Query()] = None,
    motivo: Annotated[
        Literal["compra", "venta", "devolucion", "ajuste"] | None, Query()
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MovimientoInventarioRead]:
    try:
        movimientos = service.listar_movimientos(
            id_producto,
            desde,
            hasta,
            tipo,
            motivo,
            limit,
            offset,
        )
    except ProductoError as exc:
        raise _error_http(exc) from exc

    return [
        MovimientoInventarioRead.model_validate(movimiento)
        for movimiento in movimientos
    ]


@router.post(
    "/{id_producto}/ajuste-stock",
    response_model=MovimientoInventarioRead,
    status_code=status.HTTP_201_CREATED,
)
def ajustar_stock(
    datos: ProductoAjusteStock,
    service: ServiceDep,
    id_producto: ProductoId,
) -> MovimientoInventarioRead:
    try:
        movimiento = service.ajustar_stock(id_producto, datos)
    except ProductoError as exc:
        raise _error_http(exc) from exc
    return MovimientoInventarioRead.model_validate(movimiento)
