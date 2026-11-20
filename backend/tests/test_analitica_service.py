from datetime import date, datetime
from decimal import Decimal

from app.services.analitica_service import AnaliticaService

_REFERENCIA = date(2026, 11, 17)
_DESDE = date(2026, 10, 19)
_HASTA = date(2026, 11, 17)

_VENTA_1 = {
    "id_pedido": "PV-0001",
    "fecha_hora": datetime(2026, 11, 1, 12, 0),
    "id_cliente": "CLI-0001",
    "cliente_nombre": "Ana Cliente",
    "total": Decimal("100.00"),
    "estado": "entregado",
    "items": [
        {
            "id_producto": "PRD-0001",
            "nombre": "Producto Uno",
            "id_categoria": "CAT-0001",
            "nombre_categoria": "Categoría Uno",
            "cantidad": Decimal("2.000"),
            "neto": Decimal("80.00"),
            "subtotal": Decimal("96.80"),
            "costo_unitario": Decimal("20.00"),
        }
    ],
}

_VENTA_2 = {
    "id_pedido": "PV-0002",
    "fecha_hora": datetime(2026, 10, 25, 15, 0),
    "id_cliente": "CLI-0002",
    "cliente_nombre": "Bruno Cliente",
    "total": Decimal("50.00"),
    "estado": "enviado",
    "items": [],
}

_COMPRA_PEDIDO = {
    "id_pedido": "OC-0001",
    "fecha": date(2026, 11, 5),
    "fecha_recepcion": date(2026, 11, 10),
    "id_proveedor": "PRV-0001",
    "proveedor_nombre": "Proveedor Uno",
    "total": Decimal("40.00"),
    "estado": "recibida",
    "items": [
        {
            "id_producto": "PRD-0001",
            "nombre": "Producto Uno",
            "cantidad": Decimal("4.000"),
            "precio_unitario": Decimal("10.00"),
            "subtotal": Decimal("40.00"),
        }
    ],
}

_COMPRA_RECIBIDA_FUERA_DE_PEDIDO = {
    "id_pedido": "OC-0002",
    "fecha": date(2026, 10, 1),
    "fecha_recepcion": date(2026, 11, 2),
    "id_proveedor": "PRV-0002",
    "proveedor_nombre": "Proveedor Dos",
    "total": Decimal("15.00"),
    "estado": "recibida",
    "items": [],
}


class FakeAnaliticaRepository:
    def __init__(self) -> None:
        self.ventas = [_VENTA_1, _VENTA_2]
        self.compras = [
            _COMPRA_PEDIDO,
            _COMPRA_RECIBIDA_FUERA_DE_PEDIDO,
        ]

    def listar_ventas(self, desde: date, hasta: date):
        return [
            venta
            for venta in self.ventas
            if desde <= venta["fecha_hora"].date() <= hasta
        ]

    def listar_primeras_compras(self):
        return {
            "CLI-0001": date(2026, 11, 1),
            "CLI-0002": date(2026, 10, 25),
        }

    def listar_compras(
        self, desde: date, hasta: date, *, por_recepcion: bool = False
    ):
        if por_recepcion:
            return [
                compra
                for compra in self.compras
                if compra["fecha_recepcion"] is not None
                and desde <= compra["fecha_recepcion"] <= hasta
            ]
        return [
            compra
            for compra in self.compras
            if desde <= compra["fecha"] <= hasta
        ]

    def listar_inventario(self):
        return [
            {
                "id_producto": "PRD-0001",
                "nombre": "Producto Uno",
                "stock": Decimal("10.000"),
                "costo_unitario": Decimal("20.00"),
            },
            {
                "id_producto": "PRD-0002",
                "nombre": "Producto Dos",
                "stock": Decimal("5.000"),
                "costo_unitario": Decimal("10.00"),
            },
        ]

    def listar_ultima_venta(self):
        return {"PRD-0001": date(2026, 11, 1)}

    def listar_pagos(self, desde: date, hasta: date):
        return [
            {
                "id_medio_pago": "MPG-0001",
                "medio_pago": "Efectivo",
                "monto": Decimal("100.00"),
                "estado": "aprobado",
            },
            {
                "id_medio_pago": "MPG-0002",
                "medio_pago": "Tarjeta",
                "monto": Decimal("50.00"),
                "estado": "pendiente",
            },
        ]

    def listar_historial_demanda(self, desde: date, hasta: date):
        return [
            {
                "id_producto": "PRD-0001",
                "nombre": "Producto Uno",
                "mes": date(2026, month, 1),
                "cantidad": Decimal(str(month - 5)),
            }
            for month in range(6, 12)
        ]

    def totales(self, desde: date, hasta: date):
        return {"ventas": Decimal("120.00"), "gastos": Decimal("30.00")}


def _service() -> AnaliticaService:
    return AnaliticaService(FakeAnaliticaRepository())  # type: ignore[arg-type]


def test_admin_recibe_todas_las_secciones() -> None:
    datos = _service().obtener("mes", "administrador", _REFERENCIA)

    assert datos["desde"] == _DESDE
    assert datos["hasta"] == _HASTA
    for seccion in (
        "kpis",
        "tendencias",
        "aov_upt",
        "aov_upt_actual",
        "nuevos_recurrentes",
        "ranking_productos",
        "ranking_clientes",
        "ranking_proveedores",
        "comparativa_precios",
        "margen_categorias",
        "inventario_inmovilizado",
        "mapa_calor",
        "medios_pago",
        "prediccion_demanda",
        "variacion",
    ):
        assert seccion in datos


def test_kpis_imputan_gastos_por_fecha_de_recepcion() -> None:
    datos = _service().obtener("mes", "administrador", _REFERENCIA)
    kpis = datos["kpis"]

    assert kpis["ventas"] == Decimal("150.00")
    assert kpis["compras"] == Decimal("40.00")
    assert kpis["gastos"] == Decimal("55.00")
    assert kpis["neto"] == Decimal("95.00")
    assert kpis["margen_pct"] == Decimal("63.33")
    assert kpis["costo_ventas"] == Decimal("40.00")
    assert kpis["margen_bruto"] == Decimal("40.00")
    assert kpis["margen_bruto_pct"] == Decimal("50.00")


def test_ventas_solo_recibe_secciones_comerciales() -> None:
    datos = _service().obtener("mes", "ventas", _REFERENCIA)

    assert datos["kpis"]["ventas"] == Decimal("150.00")
    # Costos y margen bruto son analíticas comerciales: ventas sí los ve.
    assert datos["kpis"]["costo_ventas"] == Decimal("40.00")
    assert datos["kpis"]["margen_bruto"] == Decimal("40.00")
    assert datos["kpis"]["margen_bruto_pct"] == Decimal("50.00")
    # El margen neto depende de gastos de compra, que siguen ocultos.
    assert datos["kpis"]["margen_pct"] is None
    assert datos["kpis"]["compras"] is None
    assert datos["kpis"]["gastos"] is None
    assert datos["kpis"]["neto"] is None
    assert all(punto["gastos"] is None for punto in datos["tendencias"])
    assert datos["variacion"]["ventas"] is not None
    assert datos["variacion"]["gastos"] is None
    for seccion in (
        "ranking_proveedores",
        "comparativa_precios",
        "inventario_inmovilizado",
        "medios_pago",
    ):
        assert seccion not in datos


def test_abastecimiento_solo_recibe_secciones_de_compra() -> None:
    datos = _service().obtener("mes", "abastecimiento", _REFERENCIA)

    assert "ranking_proveedores" in datos
    assert "comparativa_precios" in datos
    assert "inventario_inmovilizado" in datos
    assert "prediccion_demanda" in datos
    for seccion in (
        "kpis",
        "tendencias",
        "aov_upt",
        "nuevos_recurrentes",
        "ranking_productos",
        "ranking_clientes",
        "margen_categorias",
        "mapa_calor",
        "medios_pago",
        "variacion",
    ):
        assert seccion not in datos


def test_inventario_incluye_productos_nunca_vendidos() -> None:
    datos = _service().obtener("mes", "abastecimiento", _REFERENCIA)
    inventario = datos["inventario_inmovilizado"]

    assert inventario[0]["id_producto"] == "PRD-0002"
    assert inventario[0]["dias_sin_venta"] is None
    assert inventario[0]["capital"] == Decimal("50.00")
    assert inventario[1]["dias_sin_venta"] == 16


def test_medios_pago_solo_incluye_pagos_aprobados() -> None:
    datos = _service().obtener("mes", "administrador", _REFERENCIA)

    assert datos["medios_pago"] == [
        {
            "id_medio_pago": "MPG-0001",
            "medio_pago": "Efectivo",
            "monto": Decimal("100.00"),
        }
    ]


def test_prediccion_demanda_arma_historial_continuo() -> None:
    datos = _service().obtener("mes", "administrador", _REFERENCIA)
    prediccion = datos["prediccion_demanda"]

    assert len(prediccion) == 1
    assert len(prediccion[0]["historial"]) == 6
    assert len(prediccion[0]["pronostico"]) == 1
    assert prediccion[0]["pronostico"][0] >= 0


def test_periodo_desconocido_falla() -> None:
    import pytest

    from app.services.analitica_calculos import AnaliticaDatosInvalidos

    with pytest.raises(AnaliticaDatosInvalidos):
        _service().obtener("semana", "administrador", _REFERENCIA)


def test_rol_desconocido_falla() -> None:
    import pytest

    from app.services.analitica_calculos import AnaliticaDatosInvalidos

    with pytest.raises(AnaliticaDatosInvalidos):
        _service().obtener("mes", "invitado", _REFERENCIA)
