from contextlib import nullcontext
from copy import deepcopy
from datetime import date
from decimal import Decimal

import pytest
from psycopg import errors

from app.schemas.pedidos_compra import PedidoCompraCreate
from app.services.pedido_compra_service import (
    PedidoCompraDatosInvalidos,
    PedidoCompraEstadoInvalido,
    PedidoCompraService,
)


class FakePedidoCompraRepository:
    def __init__(self) -> None:
        self.pedido = None

    def transaction(self):
        return nullcontext()

    def proveedor_existe(self, _id_proveedor: str) -> bool:
        return True

    def medio_pago_existe(self, _id_medio_pago: str) -> bool:
        return True

    def crear(self, id_proveedor, id_medio_pago, id_empleado, total):
        self.pedido = {
            "id_pedido_proveedor": "OC-0001",
            "estado": "pendiente",
            "fecha_pedido": date.today(),
            "fecha_recepcion": None,
            "total": total,
            "id_empleado": id_empleado,
            "id_medio_pago": id_medio_pago,
            "medio_pago": "Transferencia",
            "id_proveedor": id_proveedor,
            "proveedor_nombre": "Proveedor de prueba",
            "items": [],
        }
        return "OC-0001"

    def crear_items(self, _id_pedido, items):
        self.pedido["items"] = [
            {
                **item,
                "producto_nombre": "Producto de prueba",
            }
            for item in items
        ]

    def obtener(self, _id_pedido, bloquear=False):
        return deepcopy(self.pedido)

    def listar(self, _estado, _q, _limit, _offset):
        return [deepcopy(self.pedido)] if self.pedido else []

    def marcar_recibida(self, _id_pedido):
        self.pedido["estado"] = "recibida"
        self.pedido["fecha_recepcion"] = date.today()
        return True

    def marcar_cancelada(self, _id_pedido):
        self.pedido["estado"] = "cancelada"
        return True


class FakeProductoRepository:
    def __init__(self) -> None:
        self.stock = Decimal("5.000")
        self.applied: list[Decimal] = []

    def obtener_activo_para_pedido(self, _id_producto):
        return {"id_producto": "PRD-0001", "estado": True}

    def aplicar_delta_stock_sistema(self, _id_producto, delta):
        self.stock += delta
        self.applied.append(delta)
        return {"id_producto": "PRD-0001", "stock_actual": self.stock}


class FakeMovimientoRepository:
    def __init__(self) -> None:
        self.created = []

    def crear_compra(self, id_pedido, id_producto, cantidad):
        self.created.append((id_pedido, id_producto, cantidad))


def _datos_pedido() -> PedidoCompraCreate:
    return PedidoCompraCreate(
        id_proveedor="PROV-0001",
        id_medio_pago="MP-0001",
        items=[
            {
                "id_producto": "PRD-0001",
                "cantidad": "2.500",
                "precio_unitario": "120.00",
            }
        ],
    )


def _service():
    pedidos = FakePedidoCompraRepository()
    productos = FakeProductoRepository()
    movimientos = FakeMovimientoRepository()
    return (
        PedidoCompraService(pedidos, productos, movimientos),
        pedidos,
        productos,
        movimientos,
    )


def test_crear_pedido_compra_calcula_total_y_asocia_empleado_autenticado() -> None:
    service, _pedidos, _productos, _movimientos = _service()

    pedido = service.crear(_datos_pedido(), "EMP-0007")

    assert pedido["total"] == Decimal("300.00")
    assert pedido["id_empleado"] == "EMP-0007"
    assert pedido["items"][0]["subtotal"] == Decimal("300.00")


def test_crear_pedido_compra_rechaza_subtotal_fuera_de_rango() -> None:
    service, pedidos, _productos, _movimientos = _service()
    datos = PedidoCompraCreate.model_validate(
        {
            "id_proveedor": "PROV-0001",
            "id_medio_pago": "MP-0001",
            "items": [
                {
                    "id_producto": "PRD-0001",
                    "cantidad": "99999999999.999",
                    "precio_unitario": "999999999999.99",
                }
            ],
        }
    )

    with pytest.raises(PedidoCompraDatosInvalidos, match="subtotal excede"):
        service.crear(datos, "EMP-0007")

    assert pedidos.pedido is None


def test_recibir_pedido_es_idempotente_y_registra_stock_una_vez() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos_pedido(), "EMP-0007")

    recibido = service.recibir(pedido["id_pedido_proveedor"])
    segundo_intento = service.recibir(pedido["id_pedido_proveedor"])

    assert recibido["estado"] == "recibida"
    assert segundo_intento["estado"] == "recibida"
    assert productos.stock == Decimal("7.500")
    assert productos.applied == [Decimal("2.500")]
    assert movimientos.created == [
        ("OC-0001", "PRD-0001", Decimal("2.500"))
    ]


def test_recibir_pedido_mapea_desborde_de_stock_a_error_de_datos() -> None:
    service, pedidos, _productos, movimientos = _service()
    pedido = service.crear(_datos_pedido(), "EMP-0007")

    class OverflowProductRepository(FakeProductoRepository):
        def aplicar_delta_stock_sistema(self, _id_producto, _delta):
            raise errors.NumericValueOutOfRange()

    service = PedidoCompraService(
        pedidos,
        OverflowProductRepository(),
        movimientos,
    )

    with pytest.raises(PedidoCompraDatosInvalidos, match="stock resultante excede"):
        service.recibir(pedido["id_pedido_proveedor"])

    assert movimientos.created == []


def test_cancelar_pedido_sin_recibir_no_modifica_stock() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos_pedido(), "EMP-0007")

    cancelado = service.cancelar(pedido["id_pedido_proveedor"])

    assert cancelado["estado"] == "cancelada"
    assert productos.stock == Decimal("5.000")
    assert productos.applied == []
    assert movimientos.created == []


def test_pedido_cancelado_no_puede_recibirse() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos_pedido(), "EMP-0007")
    service.cancelar(pedido["id_pedido_proveedor"])

    try:
        service.recibir(pedido["id_pedido_proveedor"])
    except PedidoCompraEstadoInvalido:
        pass
    else:
        raise AssertionError("Un pedido cancelado no se puede recibir")

    assert productos.applied == []
    assert movimientos.created == []
