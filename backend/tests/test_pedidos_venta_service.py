from contextlib import nullcontext
from copy import deepcopy
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.schemas.pedidos_venta import PedidoVentaInput
from app.services.pedido_venta_service import (
    PedidoVentaEstadoInvalido,
    PedidoVentaStockInsuficiente,
    PedidoVentaService,
)


class FakePedidoVentaRepository:
    def __init__(self) -> None:
        self.pedido = None

    def transaction(self):
        return nullcontext()

    def cliente_existe(self, _id_cliente: str) -> bool:
        return True

    def crear(self, datos):
        self.pedido = {
            **datos,
            "id_pedido_cliente": "PV-0001",
            "estado_envio": "pendiente",
            "fecha_emision": datetime.now(timezone.utc),
            "fecha_muestra": date.today(),
            "cliente_nombre": "Cliente",
            "cliente_apellido": "Prueba",
            "cliente_email": "cliente@example.com",
            "cliente_telefono": "123456",
            "id_presupuesto_cliente": None,
            "items": [],
        }
        return "PV-0001"

    def crear_items(self, _id_pedido, items):
        self.pedido["items"] = [
            {
                **item,
                "producto_nombre": "Producto de prueba",
            }
            for item in items
        ]

    def reemplazar(self, _id_pedido, datos, items):
        self.pedido.update(datos)
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

    def actualizar_estado(self, _id_pedido, estado_actual, estado_nuevo):
        if self.pedido["estado_envio"] != estado_actual:
            return False
        self.pedido["estado_envio"] = estado_nuevo
        return True

    def marcar_cancelado(self, _id_pedido):
        if self.pedido["estado_envio"] not in (
            "pendiente",
            "proceso",
            "enviado",
        ):
            return False
        self.pedido["estado_envio"] = "cancelado"
        return True


class FakeProductoRepository:
    def __init__(self) -> None:
        self.stock = Decimal("5.000")
        self.producto = {
            "id_producto": "PRD-0001",
            "estado": True,
            "stock_actual": self.stock,
            "precio_venta": Decimal("120.00"),
            "alicuota_porcentaje": Decimal("21.00"),
            "alicuota_tipo_iva": "gravado",
        }
        self.applied: list[Decimal] = []

    def bloquear_para_pedido_venta(
        self, id_producto, incluir_dados_de_baja=False
    ):
        if id_producto != self.producto["id_producto"]:
            return None
        if not incluir_dados_de_baja and not self.producto["estado"]:
            return None
        return {**self.producto, "stock_actual": self.stock}

    def aplicar_delta_stock(self, _id_producto, delta):
        if not self.producto["estado"] or self.stock + delta < 0:
            return None
        self.stock += delta
        self.applied.append(delta)
        return {**self.producto, "stock_actual": self.stock}

    def aplicar_delta_stock_sistema(self, _id_producto, delta):
        if self.stock + delta < 0:
            return None
        self.stock += delta
        self.applied.append(delta)
        return {**self.producto, "stock_actual": self.stock}


class FakeMovimientoRepository:
    def __init__(self) -> None:
        self.sales = []
        self.returns = []

    def crear_venta(self, id_pedido, id_producto, cantidad):
        self.sales.append((id_pedido, id_producto, cantidad))

    def crear_devolucion(self, id_pedido, id_producto, cantidad):
        self.returns.append((id_pedido, id_producto, cantidad))


def _datos(
    cantidad: str = "2",
    descuento_linea: str = "0",
    descuento_general: str = "0",
) -> PedidoVentaInput:
    return PedidoVentaInput(
        id_cliente="CLI-0001",
        entrega_provincia="Buenos Aires",
        entrega_localidad="CABA",
        entrega_calle="Av. Corrientes",
        entrega_altura="1234",
        entrega_cp="",
        entrega_depto="",
        descuento_compra=descuento_general,
        items=[
            {
                "id_producto": "PRD-0001",
                "cantidad": cantidad,
                "descuento_producto": descuento_linea,
            }
        ],
    )


def _service():
    pedidos = FakePedidoVentaRepository()
    productos = FakeProductoRepository()
    movimientos = FakeMovimientoRepository()
    return PedidoVentaService(pedidos, productos, movimientos), pedidos, productos, movimientos


def test_crear_calcula_descuentos_iva_y_reserva_stock() -> None:
    service, _pedidos, productos, movimientos = _service()

    pedido = service.crear(_datos("2", "10", "10"))

    linea = pedido["items"][0]
    assert pedido["total"] == Decimal("194.40")
    assert pedido["saldo_pendiente"] == Decimal("194.40")
    assert linea["subtotal"] == Decimal("194.40")
    assert linea["neto"] == Decimal("160.66")
    assert linea["iva"] == Decimal("33.74")
    assert productos.stock == Decimal("3.000")
    assert movimientos.sales == [("PV-0001", "PRD-0001", Decimal("2"))]


def test_editar_pedido_pendiente_aplica_deltas_de_stock() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos("2"))

    service.actualizar(pedido["id_pedido_cliente"], _datos("3"))
    assert productos.stock == Decimal("2.000")

    actualizado = service.actualizar(pedido["id_pedido_cliente"], _datos("1"))
    assert actualizado["items"][0]["cantidad"] == Decimal("1")
    assert productos.stock == Decimal("4.000")
    assert movimientos.sales == [
        ("PV-0001", "PRD-0001", Decimal("2")),
        ("PV-0001", "PRD-0001", Decimal("1")),
    ]
    assert movimientos.returns == [("PV-0001", "PRD-0001", Decimal("2"))]


def test_cancelar_restaura_stock_una_sola_vez() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos("2"))

    cancelado = service.cancelar(pedido["id_pedido_cliente"])
    segundo_intento = service.cancelar(pedido["id_pedido_cliente"])

    assert cancelado["estado_envio"] == "cancelado"
    assert segundo_intento["estado_envio"] == "cancelado"
    assert productos.stock == Decimal("5.000")
    assert movimientos.returns == [("PV-0001", "PRD-0001", Decimal("2"))]


def test_stock_insuficiente_no_crea_pedido_ni_movimiento() -> None:
    service, pedidos, productos, movimientos = _service()

    with pytest.raises(PedidoVentaStockInsuficiente):
        service.crear(_datos("6"))

    assert pedidos.pedido is None
    assert productos.stock == Decimal("5.000")
    assert movimientos.sales == []


def test_estados_son_secuenciales_y_pedido_no_puede_editarse_tras_avanzar() -> None:
    service, _pedidos, productos, _movimientos = _service()
    pedido = service.crear(_datos("2"))

    proceso = service.avanzar_estado(pedido["id_pedido_cliente"], "proceso")
    repetido = service.avanzar_estado(pedido["id_pedido_cliente"], "proceso")
    assert proceso["estado_envio"] == repetido["estado_envio"] == "proceso"

    with pytest.raises(PedidoVentaEstadoInvalido):
        service.avanzar_estado(pedido["id_pedido_cliente"], "entregado")
    with pytest.raises(PedidoVentaEstadoInvalido):
        service.actualizar(pedido["id_pedido_cliente"], _datos("1"))

    assert productos.stock == Decimal("3.000")


def test_pedido_entregado_no_puede_cancelarse() -> None:
    service, _pedidos, productos, movimientos = _service()
    pedido = service.crear(_datos("2"))
    service.avanzar_estado(pedido["id_pedido_cliente"], "proceso")
    service.avanzar_estado(pedido["id_pedido_cliente"], "enviado")
    service.avanzar_estado(pedido["id_pedido_cliente"], "entregado")

    with pytest.raises(PedidoVentaEstadoInvalido):
        service.cancelar(pedido["id_pedido_cliente"])

    assert productos.stock == Decimal("3.000")
    assert movimientos.returns == []
