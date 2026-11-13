from contextlib import nullcontext
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.schemas.presupuestos import (
    PresupuestoConversionInput,
    PresupuestoInput,
)
from app.services.presupuesto_service import (
    PresupuestoDatosInvalidos,
    PresupuestoEstadoInvalido,
    PresupuestoService,
    PresupuestoStockInsuficiente,
)


class FakePresupuestoRepository:
    def __init__(self) -> None:
        self.presupuesto = None

    def transaction(self):
        return nullcontext()

    def cliente_existe(self, _id_cliente):
        return True

    def crear(self, datos, total):
        self.presupuesto = {
            **datos,
            "id_presupuesto_cliente": "PRE-0001",
            "estado": "pendiente",
            "fecha_creacion": datetime.now(timezone.utc),
            "total": total,
            "cliente_nombre": "Ana",
            "cliente_apellido": "Prueba",
            "items": [],
        }
        return "PRE-0001"

    def crear_items(self, _id_presupuesto, items):
        self.presupuesto["items"] = [
            {**item, "producto_nombre": "Producto"} for item in items
        ]

    def obtener(self, _id_presupuesto, bloquear=False):
        return deepcopy(self.presupuesto)

    def listar(self, _estado, _q, _limit, _offset):
        return [deepcopy(self.presupuesto)] if self.presupuesto else []

    def reemplazar(self, _id_presupuesto, datos, total, items):
        if self.presupuesto["estado"] != "pendiente":
            return False
        self.presupuesto.update(datos)
        self.presupuesto["total"] = total
        self.crear_items("PRE-0001", items)
        return True

    def marcar_aprobado(self, _id_presupuesto):
        self.presupuesto["estado"] = "aprobado"
        return True

    def marcar_vencido(self, _id_presupuesto):
        if self.presupuesto["fecha_vencimiento"] < date.today():
            self.presupuesto["estado"] = "vencido"

    def eliminar(self, _id_presupuesto):
        self.presupuesto = None
        return True

    def marcar_convertido(self, _id_presupuesto):
        if self.presupuesto["estado"] != "aprobado":
            return False
        self.presupuesto["estado"] = "convertido"
        return True


class FakeProductoRepository:
    def __init__(self, stock: Decimal = Decimal("5.000")) -> None:
        self.stock = stock
        self.precio_venta = Decimal("120.00")

    def bloquear_para_pedido_venta(
        self, _id_producto, incluir_dados_de_baja=False
    ):
        return {
            "id_producto": "PRD-0001",
            "estado": True,
            "stock_actual": self.stock,
            "precio_venta": self.precio_venta,
            "alicuota_porcentaje": Decimal("21.00"),
            "alicuota_tipo_iva": "gravado",
        }

    def aplicar_delta_stock(self, _id_producto, delta):
        if self.stock + delta < 0:
            return None
        self.stock += delta
        return {"id_producto": "PRD-0001", "stock_actual": self.stock}


class FakePedidoVentaRepository:
    def __init__(self) -> None:
        self.pedido = None

    def crear(self, datos):
        self.pedido = {
            **datos,
            "id_pedido_cliente": "PV-0001",
            "estado_envio": "pendiente",
            "fecha_emision": datetime.now(timezone.utc),
            "fecha_muestra": date.today(),
            "cliente_nombre": "Ana",
            "cliente_apellido": "Prueba",
            "cliente_email": "ana@example.com",
            "cliente_telefono": "123456",
            "items": [],
        }
        return "PV-0001"

    def crear_items(self, _id_pedido, items):
        self.pedido["items"] = [
            {**item, "producto_nombre": "Producto"} for item in items
        ]

    def obtener(self, _id_pedido, bloquear=False):
        return deepcopy(self.pedido)


class FakeMovimientoRepository:
    def __init__(self) -> None:
        self.sales = []

    def crear_venta(self, id_pedido, id_producto, cantidad):
        self.sales.append((id_pedido, id_producto, cantidad))


def _datos(
    cantidad: str = "2",
    descuento_linea: str = "10",
    descuento_general: str = "10",
) -> PresupuestoInput:
    return PresupuestoInput.model_validate(
        {
            "id_cliente": "CLI-0001",
            "fecha_vencimiento": (date.today() + timedelta(days=7)).isoformat(),
            "descuento_compra": descuento_general,
            "items": [
                {
                    "id_producto": "PRD-0001",
                    "cantidad": cantidad,
                    "descuento_producto": descuento_linea,
                }
            ],
        }
    )


def _direccion() -> PresupuestoConversionInput:
    return PresupuestoConversionInput(
        entrega_provincia="Buenos Aires",
        entrega_localidad="CABA",
        entrega_calle="Av. Corrientes",
        entrega_altura="1234",
    )


def _service(stock: Decimal = Decimal("5.000")):
    presupuestos = FakePresupuestoRepository()
    pedidos = FakePedidoVentaRepository()
    productos = FakeProductoRepository(stock)
    movimientos = FakeMovimientoRepository()
    return (
        PresupuestoService(presupuestos, pedidos, productos, movimientos),
        presupuestos,
        pedidos,
        productos,
        movimientos,
    )


def test_crear_presupuesto_calcula_importes_y_no_reserva_stock() -> None:
    service, _presupuestos, _pedidos, productos, _movimientos = _service()

    presupuesto = service.crear(_datos())

    assert presupuesto["estado"] == "pendiente"
    assert presupuesto["total"] == Decimal("194.40")
    assert presupuesto["items"][0]["neto"] == Decimal("160.66")
    assert presupuesto["items"][0]["iva"] == Decimal("33.74")
    assert productos.stock == Decimal("5.000")


def test_no_se_puede_crear_presupuesto_ya_vencido() -> None:
    service, _presupuestos, _pedidos, _productos, _movimientos = _service()
    datos = PresupuestoInput.model_validate(
        {
            "id_cliente": "CLI-0001",
            "fecha_muestra": (date.today() - timedelta(days=10)).isoformat(),
            "fecha_vencimiento": (date.today() - timedelta(days=1)).isoformat(),
            "items": [
                {
                    "id_producto": "PRD-0001",
                    "cantidad": "1",
                }
            ],
        }
    )

    with pytest.raises(PresupuestoDatosInvalidos, match="no puede estar en el pasado"):
        service.crear(datos)


def test_conversion_aprobada_conserva_precio_y_reserva_stock_una_vez() -> None:
    service, presupuestos, _pedidos, productos, movimientos = _service()
    presupuesto = service.crear(_datos())
    aprobada = service.aprobar(presupuesto["id_presupuesto_cliente"])
    productos.precio_venta = Decimal("500.00")

    pedido = service.convertir(aprobada["id_presupuesto_cliente"], _direccion())

    assert pedido["id_presupuesto_cliente"] == "PRE-0001"
    assert pedido["total"] == Decimal("194.40")
    assert pedido["items"][0]["precio_unitario"] == Decimal("120.00")
    assert productos.stock == Decimal("3.000")
    assert presupuestos.presupuesto["estado"] == "convertido"
    assert movimientos.sales == [
        ("PV-0001", "PRD-0001", Decimal("2"))
    ]
    with pytest.raises(PresupuestoEstadoInvalido, match="ya fue convertido"):
        service.convertir("PRE-0001", _direccion())


def test_no_se_puede_convertir_presupuesto_sin_aprobar() -> None:
    service, _presupuestos, pedidos, productos, movimientos = _service()
    presupuesto = service.crear(_datos())

    with pytest.raises(PresupuestoEstadoInvalido, match="aprobados"):
        service.convertir(presupuesto["id_presupuesto_cliente"], _direccion())

    assert pedidos.pedido is None
    assert productos.stock == Decimal("5.000")
    assert movements_empty(movimientos)


def test_conversion_rechaza_vencimiento_y_stock_insuficiente() -> None:
    service, presupuestos, pedidos, productos, movimientos = _service(
        Decimal("1.000")
    )
    presupuesto = service.crear(_datos())
    service.aprobar(presupuesto["id_presupuesto_cliente"])

    with pytest.raises(PresupuestoStockInsuficiente):
        service.convertir("PRE-0001", _direccion())

    assert pedidos.pedido is None
    assert productos.stock == Decimal("1.000")
    assert movements_empty(movimientos)

    presupuestos.presupuesto["fecha_vencimiento"] = date.today() - timedelta(days=1)
    with pytest.raises(PresupuestoEstadoInvalido, match="vencido"):
        service.convertir("PRE-0001", _direccion())
    assert presupuestos.presupuesto["estado"] == "vencido"


def movements_empty(movimientos: FakeMovimientoRepository) -> bool:
    return movimientos.sales == []
