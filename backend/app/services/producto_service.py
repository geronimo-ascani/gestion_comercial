from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from psycopg import errors

from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
    MovimientoRow,
)
from app.repositories.producto_repository import (
    AlicuotaRow,
    ProductoRepository,
    ProductoRow,
)
from app.schemas.catalogo import ProductoAjusteStock, ProductoCreate, ProductoUpdate

_CENTAVOS = Decimal("0.01")
_MILESIMAS = Decimal("0.001")
_CIEN = Decimal("100")


def _normalizar_dinero(valor: Decimal) -> Decimal:
    return valor.quantize(_CENTAVOS, rounding=ROUND_HALF_UP)


def _normalizar_cantidad(valor: Decimal) -> Decimal:
    return valor.quantize(_MILESIMAS, rounding=ROUND_HALF_UP)


def calcular_precio_venta(
    precio_compra: Decimal, margen: Decimal, alicuota_porcentaje: Decimal
) -> Decimal:
    precio = (
        precio_compra
        * (Decimal("1") + margen / _CIEN)
        * (Decimal("1") + alicuota_porcentaje / _CIEN)
    )
    return precio.quantize(_CENTAVOS, rounding=ROUND_HALF_UP)


class ProductoError(Exception):
    pass


class ProductoNoEncontrado(ProductoError):
    pass


class ProductoEnUso(ProductoError):
    pass


class ProductoSinCambios(ProductoError):
    pass


class ProductoDatosInvalidos(ProductoError):
    pass


class ProductoStockInsuficiente(ProductoError):
    pass


class ProductoService:
    def __init__(
        self,
        repo: ProductoRepository,
        movimientos: MovimientoInventarioRepository,
    ) -> None:
        self._repo = repo
        self._movimientos = movimientos

    def _filtros(
        self,
        q: str | None,
        id_categoria: str | None,
        id_alicuota_iva: str | None,
        id_unidad: str | None,
        precio_min: Decimal | None,
        precio_max: Decimal | None,
        stock_estado: str,
        estado: bool,
        solo_alerta: bool = False,
    ) -> dict[str, object]:
        busqueda = q.strip() if q else None
        if solo_alerta:
            filtro_stock: str | None = "alerta"
        else:
            filtro_stock = None if stock_estado == "todos" else stock_estado

        return {
            "q": f"%{busqueda}%" if busqueda else None,
            "id_categoria": id_categoria,
            "id_alicuota_iva": id_alicuota_iva,
            "id_unidad": id_unidad,
            "precio_min": precio_min,
            "precio_max": precio_max,
            "estado": estado,
            "stock_estado": filtro_stock,
        }

    def _validar_precios(
        self, precio_min: Decimal | None, precio_max: Decimal | None
    ) -> None:
        if precio_min is not None and precio_max is not None and precio_min > precio_max:
            raise ProductoDatosInvalidos(
                "El precio mínimo no puede ser mayor que el precio máximo"
            )

    def _obtener_alicuota(self, id_alicuota_iva: str) -> AlicuotaRow:
        alicuota = self._repo.obtener_alicuota(id_alicuota_iva)
        if alicuota is None:
            raise ProductoDatosInvalidos(
                f"No existe la alícuota de IVA '{id_alicuota_iva}'"
            )
        return alicuota

    def _validar_categoria(self, id_categoria: str) -> None:
        if not self._repo.existe_categoria(id_categoria):
            raise ProductoDatosInvalidos(f"No existe la categoría '{id_categoria}'")

    def _resolver_unidad(self, id_unidad: str | None) -> str:
        if id_unidad is None:
            id_unidad = self._repo.obtener_unidad_por_codigo("UN")
            if id_unidad is None:
                raise ProductoDatosInvalidos(
                    "No existe la unidad por defecto 'UN' en el catálogo"
                )
            return id_unidad

        if not self._repo.existe_unidad(id_unidad):
            raise ProductoDatosInvalidos(f"No existe la unidad '{id_unidad}'")
        return id_unidad

    def listar(
        self,
        q: str | None,
        id_categoria: str | None,
        id_alicuota_iva: str | None,
        id_unidad: str | None,
        precio_min: Decimal | None,
        precio_max: Decimal | None,
        stock_estado: str,
        estado: bool,
        limit: int,
        offset: int,
    ) -> tuple[list[ProductoRow], int]:
        self._validar_precios(precio_min, precio_max)
        filtros = self._filtros(
            q,
            id_categoria,
            id_alicuota_iva,
            id_unidad,
            precio_min,
            precio_max,
            stock_estado,
            estado,
        )
        return (
            self._repo.listar(filtros, limit, offset),
            self._repo.contar(filtros),
        )

    def obtener(self, id_producto: str) -> ProductoRow:
        producto = self._repo.obtener(id_producto)
        if producto is None:
            raise ProductoNoEncontrado(id_producto)
        return producto

    def reservar_codigo(self) -> str:
        return self._repo.reservar_codigo()

    def crear(self, datos: ProductoCreate) -> ProductoRow:
        alicuota = self._obtener_alicuota(datos.id_alicuota_iva)
        self._validar_categoria(datos.id_categoria)
        id_unidad = self._resolver_unidad(datos.id_unidad)
        precio_compra = _normalizar_dinero(datos.precio_compra)
        margen = _normalizar_dinero(datos.margen)
        stock_actual = _normalizar_cantidad(datos.stock_actual)
        stock_minimo = _normalizar_cantidad(datos.stock_minimo)
        if precio_compra <= 0:
            raise ProductoDatosInvalidos(
                "El precio de compra debe ser mayor que cero"
            )
        precio_venta = calcular_precio_venta(
            precio_compra,
            margen,
            alicuota["porcentaje"],
        )

        campos = {
            "nombre": datos.nombre,
            "descripcion": datos.descripcion,
            "estado": datos.estado,
            "imagen": datos.imagen,
            "margen": margen,
            "precio_compra": precio_compra,
            "stock_actual": stock_actual,
            "stock_minimo": stock_minimo,
            "id_alicuota_iva": datos.id_alicuota_iva,
            "id_categoria": datos.id_categoria,
            "id_unidad": id_unidad,
        }
        if datos.id_producto is not None:
            campos["id_producto"] = datos.id_producto

        try:
            with self._repo.transaction():
                producto = self._repo.crear(campos, precio_venta)
                if stock_actual > 0:
                    self._movimientos.crear_ajuste(
                        producto["id_producto"],
                        "entrada",
                        stock_actual,
                    )
        except errors.ForeignKeyViolation as exc:
            raise ProductoDatosInvalidos(
                "La categoría, alícuota o unidad no existe"
            ) from exc
        except errors.CheckViolation as exc:
            raise ProductoDatosInvalidos(
                "Los datos del producto no son válidos"
            ) from exc

        return producto

    def actualizar(
        self, id_producto: str, datos: ProductoUpdate
    ) -> ProductoRow:
        actual = self.obtener(id_producto)
        cambios = {
            campo: valor
            for campo, valor in datos.model_dump(exclude_unset=True).items()
            if valor is not None
        }
        if not cambios:
            raise ProductoSinCambios(id_producto)

        if "id_categoria" in cambios:
            self._validar_categoria(cambios["id_categoria"])
        if "id_unidad" in cambios and not self._repo.existe_unidad(
            cambios["id_unidad"]
        ):
            raise ProductoDatosInvalidos(
                f"No existe la unidad '{cambios['id_unidad']}'"
            )

        if "id_alicuota_iva" in cambios:
            alicuota = self._obtener_alicuota(cambios["id_alicuota_iva"])
            alicuota_porcentaje = alicuota["porcentaje"]
        else:
            alicuota_porcentaje = actual["alicuota_porcentaje"]

        if "precio_compra" in cambios:
            cambios["precio_compra"] = _normalizar_dinero(cambios["precio_compra"])
            if cambios["precio_compra"] <= 0:
                raise ProductoDatosInvalidos(
                    "El precio de compra debe ser mayor que cero"
                )
        if "margen" in cambios:
            cambios["margen"] = _normalizar_dinero(cambios["margen"])
        if "stock_minimo" in cambios:
            cambios["stock_minimo"] = _normalizar_cantidad(cambios["stock_minimo"])

        if {"precio_compra", "margen", "id_alicuota_iva"} & cambios.keys():
            precio_compra = cambios.get("precio_compra", actual["precio_compra"])
            margen = cambios.get("margen", actual["margen"])
            cambios["precio_venta"] = calcular_precio_venta(
                precio_compra,
                margen,
                alicuota_porcentaje,
            )

        try:
            with self._repo.transaction():
                producto = self._repo.actualizar(id_producto, cambios)
                if producto is None:
                    raise ProductoNoEncontrado(id_producto)
        except errors.ForeignKeyViolation as exc:
            raise ProductoDatosInvalidos(
                "La categoría, alícuota o unidad no existe"
            ) from exc
        except errors.CheckViolation as exc:
            raise ProductoDatosInvalidos(
                "Los datos del producto no son válidos"
            ) from exc

        return producto

    def eliminar(self, id_producto: str, definitivo: bool) -> None:
        self.obtener(id_producto)

        if not definitivo:
            producto = self._repo.actualizar(id_producto, {"estado": False})
            if producto is None:
                raise ProductoNoEncontrado(id_producto)
            return

        if self._repo.esta_en_uso(id_producto):
            raise ProductoEnUso(id_producto)

        try:
            eliminado = self._repo.eliminar(id_producto)
        except errors.ForeignKeyViolation as exc:
            raise ProductoEnUso(id_producto) from exc

        if not eliminado:
            raise ProductoNoEncontrado(id_producto)

    def alertas_stock(
        self, limit: int, offset: int
    ) -> tuple[list[ProductoRow], int]:
        filtros = self._filtros(
            None,
            None,
            None,
            None,
            None,
            None,
            "todos",
            True,
            solo_alerta=True,
        )
        return (
            self._repo.listar(filtros, limit, offset),
            self._repo.contar(filtros),
        )

    def listar_movimientos(
        self,
        id_producto: str,
        desde: datetime | None,
        hasta: datetime | None,
        tipo: str | None,
        motivo: str | None,
        limit: int,
        offset: int,
    ) -> list[MovimientoRow]:
        self.obtener(id_producto)
        if desde is not None and hasta is not None and desde > hasta:
            raise ProductoDatosInvalidos(
                "La fecha 'desde' no puede ser posterior a la fecha 'hasta'"
            )
        return self._movimientos.listar_por_producto(
            id_producto,
            desde,
            hasta,
            tipo,
            motivo,
            limit,
            offset,
        )

    def ajustar_stock(
        self, id_producto: str, datos: ProductoAjusteStock
    ) -> MovimientoRow:
        self.obtener(id_producto)
        cantidad = _normalizar_cantidad(datos.cantidad)
        if cantidad <= 0:
            raise ProductoDatosInvalidos(
                "La cantidad del ajuste debe ser mayor que cero"
            )

        delta = cantidad if datos.tipo == "entrada" else -cantidad

        try:
            with self._repo.transaction():
                producto = self._repo.aplicar_delta_stock(id_producto, delta)
                if producto is None:
                    if self._repo.obtener(id_producto) is None:
                        raise ProductoNoEncontrado(id_producto)
                    raise ProductoStockInsuficiente(id_producto)
                movimiento = self._movimientos.crear_ajuste(
                    id_producto,
                    datos.tipo,
                    cantidad,
                )
        except errors.CheckViolation as exc:
            raise ProductoDatosInvalidos(
                "El stock resultante no es válido"
            ) from exc

        return movimiento
