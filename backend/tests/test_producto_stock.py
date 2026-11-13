from contextlib import nullcontext
from decimal import Decimal

import pytest
from psycopg import errors
from pydantic import ValidationError

from app.repositories.producto_repository import ProductoRepository
from app.schemas.catalogo import (
    ProductoAjusteStock,
    ProductoCreate,
    ProductoUpdate,
)
from app.services.producto_service import (
    ProductoCodigoNoDisponible,
    ProductoDatosInvalidos,
    ProductoDadoDeBaja,
    ProductoNoEncontrado,
    ProductoService,
    ProductoStockInsuficiente,
)


def test_actualizar_producto_devuelve_producto_dado_de_baja() -> None:
    producto_inactivo = {
        "id_producto": "PRD-0001",
        "estado": False,
    }

    class FakeCursor:
        def __init__(self, connection) -> None:
            self.connection = connection
            self.row = None

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def execute(self, query, params) -> None:
            if "UPDATE producto" in str(query):
                self.row = {"id_producto": "PRD-0001"}
            elif params == ("PRD-0001", True):
                self.row = producto_inactivo

        def fetchone(self):
            return self.row

    class FakeConnection:
        def cursor(self, **_kwargs):
            return FakeCursor(self)

    producto = ProductoRepository(FakeConnection()).actualizar(
        "PRD-0001", {"estado": False}
    )

    assert producto == producto_inactivo


class FakeProductoRepository:
    def __init__(self, stock: Decimal) -> None:
        self.stock = stock
        self.delta: Decimal | None = None

    def transaction(self):
        return nullcontext()

    def obtener(self, _id_producto: str, incluir_dados_de_baja: bool = False):
        return {
            "id_producto": "PRD-0001",
            "estado": True,
            "stock_actual": self.stock,
        }

    def aplicar_delta_stock(self, _id_producto: str, delta: Decimal):
        self.delta = delta
        if self.stock + delta < 0:
            return None
        self.stock += delta
        return {"id_producto": "PRD-0001", "stock_actual": self.stock}


class FakeMovimientoRepository:
    def __init__(self) -> None:
        self.created: tuple[str, str, Decimal] | None = None

    def crear_ajuste(self, id_producto: str, tipo: str, cantidad: Decimal):
        self.created = (id_producto, tipo, cantidad)
        return {"id_movimiento": "MOV-0001", "id_producto": id_producto}


class FakeCodigoRepository:
    def __init__(self, state: str | None) -> None:
        self.state = state
        self.product = None

    def estado_codigo_reservado(self, _id_producto: str):
        return self.state

    def anular_codigo_reservado(self, _id_producto: str):
        if self.state != "reservado":
            return False
        self.state = "anulado"
        return True

    def obtener(
        self, _id_producto: str, incluir_dados_de_baja: bool = False
    ):
        return self.product


def test_ajuste_stock_aplica_delta_atomico_y_registra_movimiento() -> None:
    productos = FakeProductoRepository(Decimal("5.000"))
    movimientos = FakeMovimientoRepository()
    service = ProductoService(productos, movimientos)

    service.ajustar_stock(
        "PRD-0001",
        ProductoAjusteStock(tipo="salida", cantidad=Decimal("2")),
    )

    assert productos.stock == Decimal("3.000")
    assert productos.delta == Decimal("-2.000")
    assert movimientos.created == (
        "PRD-0001",
        "salida",
        Decimal("2.000"),
    )


def test_ajuste_stock_no_registra_salida_que_deja_saldo_negativo() -> None:
    productos = FakeProductoRepository(Decimal("1.000"))
    movimientos = FakeMovimientoRepository()
    service = ProductoService(productos, movimientos)

    try:
        service.ajustar_stock(
            "PRD-0001",
            ProductoAjusteStock(tipo="salida", cantidad=Decimal("2")),
        )
    except ProductoStockInsuficiente:
        pass
    else:
        raise AssertionError("Se esperaba un error de stock insuficiente")

    assert productos.stock == Decimal("1.000")
    assert movimientos.created is None


def test_producto_update_no_acepta_modificar_saldo_directamente() -> None:
    try:
        ProductoUpdate.model_validate({"stock_actual": 20})
    except ValueError:
        pass
    else:
        raise AssertionError("stock_actual no debe ser actualizable por PATCH")


def test_producto_schema_rechaza_valores_fuera_de_precision_sql() -> None:
    datos_producto = {
        "nombre": "Producto de prueba",
        "margen": "100000.00",
        "precio_compra": "10.00",
        "stock_actual": "0.000",
        "stock_minimo": "0.000",
        "id_alicuota_iva": "IVA-0001",
        "id_categoria": "CAT-0001",
    }

    with pytest.raises(ValidationError):
        ProductoCreate.model_validate(datos_producto)
    with pytest.raises(ValidationError):
        ProductoUpdate.model_validate({"margen": "100000.00"})
    with pytest.raises(ValidationError):
        ProductoUpdate.model_validate({"precio_compra": "1000000000000.00"})
    with pytest.raises(ValidationError):
        ProductoAjusteStock.model_validate(
            {"tipo": "entrada", "cantidad": "100000000000.000"}
        )


def test_crear_producto_rechaza_precio_venta_calculado_fuera_de_rango() -> None:
    class FakeCatalogoRepository:
        def obtener_alicuota(self, _id_alicuota):
            return {"porcentaje": Decimal("21.00")}

        def existe_categoria(self, _id_categoria):
            return True

        def obtener_unidad_por_codigo(self, _codigo):
            return "UN"

        def transaction(self):
            return nullcontext()

        def crear(self, _campos, _precio_venta):
            raise AssertionError("No debe persistir un precio fuera de rango")

    datos = ProductoCreate.model_validate(
        {
            "nombre": "Producto de prueba",
            "margen": "1.00",
            "precio_compra": "999999999999.99",
            "stock_actual": "0.000",
            "stock_minimo": "0.000",
            "id_alicuota_iva": "IVA-0001",
            "id_categoria": "CAT-0001",
        }
    )
    service = ProductoService(
        FakeCatalogoRepository(),
        FakeMovimientoRepository(),
    )

    with pytest.raises(ProductoDatosInvalidos, match="precio de venta calculado"):
        service.crear(datos)


def test_actualizar_producto_rechaza_precio_venta_calculado_fuera_de_rango() -> None:
    class FakeCatalogoRepository:
        def obtener(self, _id_producto, incluir_dados_de_baja=False):
            return {
                "id_producto": "PRD-0001",
                "estado": True,
                "precio_compra": Decimal("999999999999.99"),
                "margen": Decimal("0.00"),
                "alicuota_porcentaje": Decimal("21.00"),
            }

        def actualizar(self, _id_producto, _cambios):
            raise AssertionError("No debe persistir un precio fuera de rango")

    service = ProductoService(
        FakeCatalogoRepository(),
        FakeMovimientoRepository(),
    )

    with pytest.raises(ProductoDatosInvalidos, match="precio de venta calculado"):
        service.actualizar("PRD-0001", ProductoUpdate(margen=Decimal("1.00")))


def test_ajuste_stock_mapea_desborde_numerico_a_error_de_datos() -> None:
    class OverflowRepository(FakeProductoRepository):
        def aplicar_delta_stock(self, _id_producto, _delta):
            raise errors.NumericValueOutOfRange()

    service = ProductoService(
        OverflowRepository(Decimal("99999999999.999")),
        FakeMovimientoRepository(),
    )

    with pytest.raises(ProductoDatosInvalidos, match="stock resultante excede"):
        service.ajustar_stock(
            "PRD-0001",
            ProductoAjusteStock(tipo="entrada", cantidad=Decimal("1.000")),
        )


def test_codigo_reservado_puede_anularse_una_sola_vez() -> None:
    repo = FakeCodigoRepository("reservado")
    service = ProductoService(repo, FakeMovimientoRepository())

    service.anular_codigo("PRD-0001")

    assert repo.state == "anulado"
    try:
        service.anular_codigo("PRD-0001")
    except ProductoCodigoNoDisponible:
        pass
    else:
        raise AssertionError("No se debe anular dos veces una misma reserva")


def test_producto_inactivo_no_se_puede_obtener_para_operaciones() -> None:
    class InactiveRepository(FakeProductoRepository):
        def obtener(self, _id_producto: str, incluir_dados_de_baja: bool = False):
            if incluir_dados_de_baja:
                return {
                    "id_producto": "PRD-0001",
                    "estado": False,
                    "stock_actual": self.stock,
                }
            return None

    service = ProductoService(
        InactiveRepository(Decimal("5.000")),
        FakeMovimientoRepository(),
    )
    try:
        service.obtener("PRD-0001")
    except ProductoNoEncontrado:
        pass
    else:
        raise AssertionError("Los productos dados de baja no deben estar operativos")


def test_producto_inactivo_no_admite_ajustes_de_stock() -> None:
    class InactiveRepository(FakeProductoRepository):
        def obtener(self, _id_producto: str, incluir_dados_de_baja: bool = False):
            if incluir_dados_de_baja:
                return {
                    "id_producto": "PRD-0001",
                    "estado": False,
                    "stock_actual": self.stock,
                }
            return None

    movements = FakeMovimientoRepository()
    service = ProductoService(
        InactiveRepository(Decimal("5.000")),
        movements,
    )
    try:
        service.ajustar_stock(
            "PRD-0001",
            ProductoAjusteStock(tipo="entrada", cantidad=Decimal("1")),
        )
    except ProductoNoEncontrado:
        pass
    else:
        raise AssertionError("Un producto dado de baja no debe aceptar ajustes")
    assert movements.created is None
