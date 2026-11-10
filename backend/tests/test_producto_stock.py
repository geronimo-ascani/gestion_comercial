from contextlib import nullcontext
from decimal import Decimal

from app.schemas.catalogo import ProductoAjusteStock, ProductoUpdate
from app.services.producto_service import (
    ProductoService,
    ProductoStockInsuficiente,
)


class FakeProductoRepository:
    def __init__(self, stock: Decimal) -> None:
        self.stock = stock
        self.delta: Decimal | None = None

    def transaction(self):
        return nullcontext()

    def obtener(self, _id_producto: str):
        return {"id_producto": "PRD-0001", "stock_actual": self.stock}

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
