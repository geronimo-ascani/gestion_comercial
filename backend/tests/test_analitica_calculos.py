from datetime import date, datetime
from decimal import Decimal

import pytest

from app.services.analitica_calculos import (
    AnaliticaDatosInvalidos,
    calcular_aov_upt,
    calcular_aov_upt_por_periodo,
    calcular_comparativa_precios,
    calcular_inventario_inmovilizado,
    calcular_kpis,
    calcular_mapa_calor,
    calcular_margen_por_categoria,
    calcular_nuevos_vs_recurrentes,
    calcular_primeras_compras,
    calcular_ranking_clientes,
    calcular_ranking_productos,
    calcular_ranking_proveedores,
    calcular_tendencias,
    calcular_variacion,
    calcular_ventas_por_metodo_pago,
    predecir_demanda,
    rango_comparacion,
    rango_periodo,
)

_D = Decimal


def _item_venta(
    id_producto: str = "PRD-1",
    nombre: str = "Producto",
    id_categoria: str = "CAT-1",
    nombre_categoria: str = "Categoría",
    cantidad: str = "1",
    neto: str = "10",
    subtotal: str = "12.10",
    costo_unitario: str = "5",
) -> dict:
    return {
        "id_producto": id_producto,
        "nombre": nombre,
        "id_categoria": id_categoria,
        "nombre_categoria": nombre_categoria,
        "cantidad": _D(cantidad),
        "neto": _D(neto),
        "subtotal": _D(subtotal),
        "costo_unitario": _D(costo_unitario),
    }


def _venta(
    id_pedido: str = "PV-1",
    fecha_hora: datetime = datetime(2026, 11, 16, 10, 0),
    id_cliente: str = "CLI-1",
    cliente_nombre: str = "Ana",
    total: str = "12.10",
    estado: str = "pendiente",
    items: list[dict] | None = None,
) -> dict:
    return {
        "id_pedido": id_pedido,
        "fecha_hora": fecha_hora,
        "id_cliente": id_cliente,
        "cliente_nombre": cliente_nombre,
        "total": _D(total),
        "estado": estado,
        "items": items if items is not None else [_item_venta()],
    }


def _item_compra(
    id_producto: str = "PRD-1",
    nombre: str = "Producto",
    cantidad: str = "10",
    precio_unitario: str = "2",
    subtotal: str = "20",
) -> dict:
    return {
        "id_producto": id_producto,
        "nombre": nombre,
        "cantidad": _D(cantidad),
        "precio_unitario": _D(precio_unitario),
        "subtotal": _D(subtotal),
    }


def _compra(
    id_pedido: str = "PC-1",
    fecha: date = date(2026, 11, 16),
    fecha_recepcion: date | None = None,
    id_proveedor: str = "PRV-1",
    proveedor_nombre: str = "Proveedor",
    total: str = "20",
    estado: str = "recibida",
    items: list[dict] | None = None,
) -> dict:
    return {
        "id_pedido": id_pedido,
        "fecha": fecha,
        "fecha_recepcion": fecha_recepcion,
        "id_proveedor": id_proveedor,
        "proveedor_nombre": proveedor_nombre,
        "total": _D(total),
        "estado": estado,
        "items": items if items is not None else [_item_compra()],
    }


# --- rango_periodo ---------------------------------------------------------


def test_rango_periodo_cubre_todos_los_periodos() -> None:
    referencia = date(2026, 11, 17)

    assert rango_periodo("hoy", referencia) == (referencia, referencia)
    assert rango_periodo("7d", referencia) == (date(2026, 11, 11), referencia)
    assert rango_periodo("mes", referencia) == (date(2026, 10, 19), referencia)
    assert rango_periodo("trimestre", referencia) == (
        date(2026, 8, 20),
        referencia,
    )
    assert rango_periodo("año", referencia) == (date(2026, 1, 1), referencia)


def test_rango_periodo_desconocido_falla() -> None:
    with pytest.raises(AnaliticaDatosInvalidos):
        rango_periodo("semana", date(2026, 11, 17))  # type: ignore[arg-type]


def test_rango_comparacion_anio_usa_mismo_acumulado_del_anio_anterior() -> None:
    desde, hasta = rango_periodo("año", date(2026, 11, 20))

    assert rango_comparacion("año", desde, hasta) == (
        date(2025, 1, 1),
        date(2025, 11, 20),
    )


def test_rango_comparacion_anio_bisiesto_ajusta_fecha_final() -> None:
    desde, hasta = rango_periodo("año", date(2024, 2, 29))

    assert rango_comparacion("año", desde, hasta) == (
        date(2023, 1, 1),
        date(2023, 2, 28),
    )


def test_rango_comparacion_periodos_moviles_usa_ventana_inmediata() -> None:
    desde, hasta = rango_periodo("7d", date(2026, 11, 17))

    assert rango_comparacion("7d", desde, hasta) == (
        date(2026, 11, 4),
        date(2026, 11, 10),
    )


# --- KPIs ------------------------------------------------------------------


def test_kpis_operativos_y_margen_bruto() -> None:
    ventas = [
        _venta(
            id_pedido="PV-1",
            total="121",
            items=[_item_venta(cantidad="2", neto="100", costo_unitario="30")],
        ),
        _venta(
            id_pedido="PV-2",
            total="50",
            estado="entregado",
            items=[_item_venta(cantidad="1", neto="40", costo_unitario="10")],
        ),
        _venta(id_pedido="PV-3", total="999", estado="cancelado"),
    ]
    compras = [
        _compra(id_pedido="PC-1", total="80", estado="recibida"),
        _compra(id_pedido="PC-2", total="20", estado="pendiente"),
        _compra(id_pedido="PC-3", total="500", estado="cancelada"),
    ]

    kpis = calcular_kpis(ventas, compras)

    assert kpis["ventas"] == _D("171.00")
    assert kpis["compras"] == _D("100.00")
    assert kpis["gastos"] == _D("80.00")
    assert kpis["neto"] == _D("91.00")
    assert kpis["margen_pct"] == _D("53.22")
    assert kpis["costo_ventas"] == _D("70.00")
    assert kpis["margen_bruto"] == _D("70.00")
    assert kpis["margen_bruto_pct"] == _D("50.00")


def test_kpis_sin_datos_devuelven_ceros() -> None:
    kpis = calcular_kpis([], [])

    assert kpis == {
        "ventas": _D("0.00"),
        "compras": _D("0.00"),
        "gastos": _D("0.00"),
        "neto": _D("0.00"),
        "margen_pct": _D("0.00"),
        "costo_ventas": _D("0.00"),
        "margen_bruto": _D("0.00"),
        "margen_bruto_pct": _D("0.00"),
    }


# --- tendencias ------------------------------------------------------------


def test_tendencias_diarias_rellenan_buckets_y_filtran_estados() -> None:
    ventas = [
        _venta(fecha_hora=datetime(2026, 11, 16, 9, 0), total="100"),
        _venta(fecha_hora=datetime(2026, 11, 18, 9, 0), total="50"),
        _venta(
            fecha_hora=datetime(2026, 11, 17, 9, 0),
            total="999",
            estado="cancelado",
        ),
    ]
    compras = [
        _compra(fecha=date(2026, 11, 17), total="30", estado="recibida"),
        _compra(fecha=date(2026, 11, 17), total="70", estado="pendiente"),
    ]

    puntos = calcular_tendencias(
        ventas,
        compras,
        "diario",
        date(2026, 11, 16),
        date(2026, 11, 18),
    )

    assert [punto["inicio"] for punto in puntos] == [
        date(2026, 11, 16),
        date(2026, 11, 17),
        date(2026, 11, 18),
    ]
    assert [punto["fin"] for punto in puntos] == [
        date(2026, 11, 16),
        date(2026, 11, 17),
        date(2026, 11, 18),
    ]
    assert [punto["ventas"] for punto in puntos] == [
        _D("100.00"),
        _D("0.00"),
        _D("50.00"),
    ]
    assert [punto["gastos"] for punto in puntos] == [
        _D("0.00"),
        _D("30.00"),
        _D("0.00"),
    ]


def test_tendencias_imputan_gastos_en_fecha_de_recepcion() -> None:
    compras = [
        _compra(
            fecha=date(2026, 11, 10),
            fecha_recepcion=date(2026, 11, 17),
            total="40",
            estado="recibida",
        )
    ]

    puntos = calcular_tendencias(
        [],
        compras,
        "diario",
        date(2026, 11, 16),
        date(2026, 11, 17),
    )

    assert [punto["gastos"] for punto in puntos] == [
        _D("0.00"),
        _D("40.00"),
    ]


def test_tendencias_semanales_empiezan_lunes() -> None:
    ventas = [_venta(fecha_hora=datetime(2026, 11, 18, 9, 0), total="10")]
    compras = [_compra(fecha=date(2026, 11, 24), total="5")]

    puntos = calcular_tendencias(
        ventas,
        compras,
        "semanal",
        date(2026, 11, 16),
        date(2026, 11, 29),
    )

    assert [(p["inicio"], p["fin"]) for p in puntos] == [
        (date(2026, 11, 16), date(2026, 11, 22)),
        (date(2026, 11, 23), date(2026, 11, 29)),
    ]
    assert [p["ventas"] for p in puntos] == [_D("10.00"), _D("0.00")]
    assert [p["gastos"] for p in puntos] == [_D("0.00"), _D("5.00")]


def test_tendencias_mensuales_y_anuales() -> None:
    mensual = calcular_tendencias(
        [],
        [],
        "mensual",
        date(2026, 11, 5),
        date(2026, 12, 15),
    )
    assert [(p["inicio"], p["fin"]) for p in mensual] == [
        (date(2026, 11, 1), date(2026, 11, 30)),
        (date(2026, 12, 1), date(2026, 12, 31)),
    ]

    anual = calcular_tendencias(
        [],
        [],
        "anual",
        date(2025, 6, 1),
        date(2026, 11, 17),
    )
    assert [(p["inicio"], p["fin"]) for p in anual] == [
        (date(2025, 1, 1), date(2025, 12, 31)),
        (date(2026, 1, 1), date(2026, 12, 31)),
    ]


def test_tendencias_rango_invalido_falla() -> None:
    with pytest.raises(AnaliticaDatosInvalidos):
        calcular_tendencias(
            [],
            [],
            "diario",
            date(2026, 11, 18),
            date(2026, 11, 16),
        )


def test_tendencias_granularidad_desconocida_falla() -> None:
    with pytest.raises(AnaliticaDatosInvalidos):
        calcular_tendencias(
            [],
            [],
            "semestral",  # type: ignore[arg-type]
            date(2026, 11, 16),
            date(2026, 11, 18),
        )


# --- AOV / UPT -------------------------------------------------------------


def test_aov_upt_calcula_ticket_y_unidades_por_pedido() -> None:
    ventas = [
        _venta(
            id_pedido="PV-1",
            total="100",
            items=[_item_venta(cantidad="2"), _item_venta(cantidad="3")],
        ),
        _venta(
            id_pedido="PV-2",
            total="50",
            items=[_item_venta(cantidad="1")],
        ),
        _venta(id_pedido="PV-3", total="999", estado="cancelado"),
    ]

    resultado = calcular_aov_upt(ventas)

    assert resultado["aov"] == _D("75.00")
    assert resultado["upt"] == _D("3.000")


def test_aov_upt_sin_ventas_devuelve_ceros() -> None:
    assert calcular_aov_upt([]) == {
        "aov": _D("0.00"),
        "upt": _D("0.000"),
    }


def test_aov_upt_por_periodo() -> None:
    ventas = [
        _venta(
            id_pedido="PV-1",
            fecha_hora=datetime(2026, 11, 16, 9, 0),
            total="100",
            items=[_item_venta(cantidad="2")],
        ),
        _venta(
            id_pedido="PV-2",
            fecha_hora=datetime(2026, 11, 18, 9, 0),
            total="30",
            items=[_item_venta(cantidad="1")],
        ),
    ]

    puntos = calcular_aov_upt_por_periodo(
        ventas,
        "diario",
        date(2026, 11, 16),
        date(2026, 11, 18),
    )

    assert [(p["aov"], p["upt"]) for p in puntos] == [
        (_D("100.00"), _D("2.000")),
        (_D("0.00"), _D("0.000")),
        (_D("30.00"), _D("1.000")),
    ]


# --- nuevos vs recurrentes -------------------------------------------------


def test_primeras_compras_ignora_canceladas_y_toma_la_menor_fecha() -> None:
    ventas = [
        _venta(
            id_cliente="CLI-1",
            fecha_hora=datetime(2026, 11, 20, 9, 0),
        ),
        _venta(
            id_cliente="CLI-1",
            fecha_hora=datetime(2026, 11, 10, 9, 0),
        ),
        _venta(
            id_cliente="CLI-2",
            fecha_hora=datetime(2026, 11, 5, 9, 0),
            estado="cancelado",
        ),
    ]

    assert calcular_primeras_compras(ventas) == {"CLI-1": date(2026, 11, 10)}


def test_nuevos_vs_recurrentes_por_dia_de_primera_compra() -> None:
    ventas = [
        _venta(
            id_pedido="PV-1",
            id_cliente="CLI-1",
            fecha_hora=datetime(2026, 11, 16, 9, 0),
            total="100",
        ),
        _venta(
            id_pedido="PV-2",
            id_cliente="CLI-1",
            fecha_hora=datetime(2026, 11, 17, 9, 0),
            total="40",
        ),
        _venta(
            id_pedido="PV-3",
            id_cliente="CLI-2",
            fecha_hora=datetime(2026, 11, 17, 12, 0),
            total="60",
        ),
    ]

    puntos = calcular_nuevos_vs_recurrentes(
        ventas,
        {"CLI-1": date(2026, 11, 16)},
        "diario",
        date(2026, 11, 16),
        date(2026, 11, 17),
    )

    assert [p["nuevos"] for p in puntos] == [_D("100.00"), _D("60.00")]
    assert [p["recurrentes"] for p in puntos] == [_D("0.00"), _D("40.00")]


# --- rankings --------------------------------------------------------------


def test_ranking_productos_agrega_y_ordena_por_cantidad() -> None:
    ventas = [
        _venta(
            id_pedido="PV-1",
            items=[
                _item_venta(
                    id_producto="PRD-1",
                    nombre="A",
                    cantidad="2",
                    neto="100",
                    costo_unitario="30",
                ),
                _item_venta(
                    id_producto="PRD-2",
                    nombre="B",
                    cantidad="6",
                    neto="50",
                    costo_unitario="5",
                ),
            ],
        ),
        _venta(
            id_pedido="PV-2",
            items=[
                _item_venta(
                    id_producto="PRD-1",
                    nombre="A",
                    cantidad="3",
                    neto="150",
                    costo_unitario="30",
                )
            ],
        ),
        _venta(
            id_pedido="PV-3",
            estado="cancelado",
            items=[_item_venta(id_producto="PRD-9", cantidad="99")],
        ),
    ]

    ranking = calcular_ranking_productos(ventas)

    assert [fila["id_producto"] for fila in ranking] == ["PRD-2", "PRD-1"]
    primero = ranking[0]
    assert primero["cantidad"] == _D("6.000")
    assert primero["venta_neta"] == _D("50.00")
    assert primero["costo"] == _D("30.00")
    assert primero["margen"] == _D("20.00")
    assert primero["margen_pct"] == _D("40.00")

    segundo = ranking[1]
    assert segundo["cantidad"] == _D("5.000")
    assert segundo["venta_neta"] == _D("250.00")
    assert segundo["costo"] == _D("150.00")
    assert segundo["margen"] == _D("100.00")
    assert segundo["margen_pct"] == _D("40.00")


def test_ranking_productos_respeta_limite_y_orden_ascendente() -> None:
    ventas = [
        _venta(
            items=[
                _item_venta(id_producto="PRD-1", nombre="A", cantidad="1"),
                _item_venta(id_producto="PRD-2", nombre="B", cantidad="3"),
                _item_venta(id_producto="PRD-3", nombre="C", cantidad="2"),
            ]
        )
    ]

    assert [
        fila["id_producto"]
        for fila in calcular_ranking_productos(ventas, limite=2)
    ] == ["PRD-2", "PRD-3"]
    assert [
        fila["id_producto"]
        for fila in calcular_ranking_productos(ventas, orden="asc")
    ] == ["PRD-1", "PRD-3", "PRD-2"]


def test_ranking_productos_desempata_por_nombre() -> None:
    ventas = [
        _venta(
            items=[
                _item_venta(id_producto="PRD-2", nombre="B", cantidad="2"),
                _item_venta(id_producto="PRD-1", nombre="A", cantidad="2"),
            ]
        )
    ]

    assert [
        fila["id_producto"] for fila in calcular_ranking_productos(ventas)
    ] == ["PRD-1", "PRD-2"]


def test_ranking_clientes_ordena_por_facturacion() -> None:
    ventas = [
        _venta(id_cliente="CLI-1", cliente_nombre="Ana", total="100"),
        _venta(id_cliente="CLI-2", cliente_nombre="Beto", total="300"),
        _venta(id_cliente="CLI-1", cliente_nombre="Ana", total="50"),
        _venta(
            id_cliente="CLI-3",
            cliente_nombre="Caro",
            total="999",
            estado="cancelado",
        ),
    ]

    ranking = calcular_ranking_clientes(ventas)

    assert [fila["id_cliente"] for fila in ranking] == ["CLI-2", "CLI-1"]
    assert ranking[0]["pedidos"] == 1
    assert ranking[0]["facturacion"] == _D("300.00")
    assert ranking[1]["pedidos"] == 2
    assert ranking[1]["facturacion"] == _D("150.00")


def test_ranking_proveedores_calcula_volumen_precio_y_entrega() -> None:
    compras = [
        _compra(
            id_pedido="PC-1",
            fecha=date(2026, 11, 2),
            fecha_recepcion=date(2026, 11, 5),
            total="20",
            items=[_item_compra(cantidad="10", precio_unitario="2", subtotal="20")],
        ),
        _compra(
            id_pedido="PC-2",
            fecha=date(2026, 11, 10),
            fecha_recepcion=None,
            total="20",
            items=[_item_compra(cantidad="5", precio_unitario="4", subtotal="20")],
        ),
        _compra(
            id_pedido="PC-3",
            id_proveedor="PRV-2",
            proveedor_nombre="Otro",
            total="999",
            estado="cancelada",
        ),
    ]

    ranking = calcular_ranking_proveedores(compras)

    assert len(ranking) == 1
    fila = ranking[0]
    assert fila["id_proveedor"] == "PRV-1"
    assert fila["pedidos"] == 2
    assert fila["volumen_compra"] == _D("40.00")
    assert fila["unidades"] == _D("15.000")
    assert fila["precio_promedio"] == _D("2.67")
    assert fila["entrega_promedio_dias"] == _D("3.00")


def test_ranking_proveedores_sin_entregas_devuelve_none() -> None:
    ranking = calcular_ranking_proveedores([_compra()])
    assert ranking[0]["entrega_promedio_dias"] is None


def test_comparativa_precios_por_proveedor() -> None:
    compras = [
        _compra(
            id_proveedor="PRV-1",
            proveedor_nombre="Proveedor 1",
            fecha=date(2026, 11, 2),
            total="20",
            items=[
                _item_compra(
                    id_producto="PRD-1",
                    nombre="Producto",
                    cantidad="10",
                    precio_unitario="2",
                    subtotal="20",
                )
            ],
        ),
        _compra(
            id_proveedor="PRV-1",
            proveedor_nombre="Proveedor 1",
            fecha=date(2026, 11, 10),
            total="20",
            items=[
                _item_compra(
                    id_producto="PRD-1",
                    nombre="Producto",
                    cantidad="5",
                    precio_unitario="4",
                    subtotal="20",
                )
            ],
        ),
        _compra(
            id_proveedor="PRV-2",
            proveedor_nombre="Proveedor 2",
            fecha=date(2026, 11, 12),
            total="9",
            items=[
                _item_compra(
                    id_producto="PRD-1",
                    nombre="Producto",
                    cantidad="3",
                    precio_unitario="3",
                    subtotal="9",
                )
            ],
        ),
    ]

    comparativas = calcular_comparativa_precios(compras)

    assert len(comparativas) == 1
    comparativa = comparativas[0]
    assert comparativa["id_producto"] == "PRD-1"
    assert [p["id_proveedor"] for p in comparativa["proveedores"]] == [
        "PRV-1",
        "PRV-2",
    ]
    primero = comparativa["proveedores"][0]
    assert primero["precio_minimo"] == _D("2.00")
    assert primero["precio_promedio"] == _D("2.67")
    assert primero["ultima_compra"] == date(2026, 11, 10)


# --- inventario inmovilizado ----------------------------------------------


def test_inventario_inmovilizado_prioriza_nunca_vendidos() -> None:
    productos = [
        {"id_producto": "PRD-1", "nombre": "A", "stock": _D("10"), "costo_unitario": _D("5")},
        {"id_producto": "PRD-2", "nombre": "B", "stock": _D("4"), "costo_unitario": _D("2.5")},
        {"id_producto": "PRD-3", "nombre": "C", "stock": _D("0"), "costo_unitario": _D("9")},
    ]
    ultima_venta = {
        "PRD-1": date(2026, 11, 1),
    }

    filas = calcular_inventario_inmovilizado(
        productos,
        ultima_venta,
        date(2026, 11, 16),
    )

    assert [fila["id_producto"] for fila in filas] == ["PRD-2", "PRD-1"]
    nunca_vendido = filas[0]
    assert nunca_vendido["id_producto"] == "PRD-2"
    assert nunca_vendido["dias_sin_venta"] is None
    assert nunca_vendido["capital"] == _D("10.00")

    assert filas[1]["id_producto"] == "PRD-1"
    assert filas[1]["dias_sin_venta"] == 15
    assert filas[1]["capital"] == _D("50.00")


def test_inventario_inmovilizado_filtra_por_dias_minimos() -> None:
    productos = [
        {"id_producto": "PRD-1", "nombre": "A", "stock": _D("10"), "costo_unitario": _D("5")},
        {"id_producto": "PRD-2", "nombre": "B", "stock": _D("4"), "costo_unitario": _D("2.5")},
    ]
    ultima_venta = {
        "PRD-1": date(2026, 11, 10),
        "PRD-2": date(2026, 9, 1),
    }

    filas = calcular_inventario_inmovilizado(
        productos,
        ultima_venta,
        date(2026, 11, 16),
        dias_minimos=30,
    )

    assert [fila["id_producto"] for fila in filas] == ["PRD-2"]


# --- margen por categoría --------------------------------------------------


def test_margen_por_categoria_agrega_y_ordena() -> None:
    ventas = [
        _venta(
            items=[
                _item_venta(
                    id_categoria="CAT-1",
                    nombre_categoria="Bebidas",
                    neto="100",
                    cantidad="2",
                    costo_unitario="30",
                ),
                _item_venta(
                    id_categoria="CAT-2",
                    nombre_categoria="Almacén",
                    neto="50",
                    cantidad="1",
                    costo_unitario="5",
                ),
            ]
        ),
        _venta(
            items=[
                _item_venta(
                    id_categoria="CAT-1",
                    nombre_categoria="Bebidas",
                    neto="50",
                    cantidad="1",
                    costo_unitario="30",
                )
            ],
        ),
    ]

    margenes = calcular_margen_por_categoria(ventas)

    assert [fila["id_categoria"] for fila in margenes] == ["CAT-1", "CAT-2"]
    bebidas = margenes[0]
    assert bebidas["venta_neta"] == _D("150.00")
    assert bebidas["costo"] == _D("90.00")
    assert bebidas["margen"] == _D("60.00")
    assert bebidas["margen_pct"] == _D("40.00")


# --- mapa de calor ---------------------------------------------------------


def test_mapa_calor_ubica_ventas_por_dia_y_hora() -> None:
    ventas = [
        _venta(fecha_hora=datetime(2026, 11, 16, 10, 0), total="100"),
        _venta(fecha_hora=datetime(2026, 11, 16, 10, 30), total="50"),
        _venta(fecha_hora=datetime(2026, 11, 22, 21, 0), total="25"),
        _venta(fecha_hora=datetime(2026, 11, 16, 7, 0), total="999"),
    ]

    mapa = calcular_mapa_calor(ventas)

    assert mapa["dias"] == list(range(7))
    assert mapa["horas"][0] == 8
    assert mapa["horas"][-1] == 21
    assert mapa["valores"][0][2] == _D("150.00")
    assert mapa["valores"][6][13] == _D("25.00")
    assert sum(sum(fila) for fila in mapa["valores"]) == _D("175.00")


def test_mapa_calor_rango_invalido_falla() -> None:
    with pytest.raises(AnaliticaDatosInvalidos):
        calcular_mapa_calor([], hora_desde=20, hora_hasta=8)


def test_mapa_calor_sin_datos_devuelve_matriz_en_cero() -> None:
    mapa = calcular_mapa_calor([])
    assert all(valor == _D("0.00") for fila in mapa["valores"] for valor in fila)


# --- medios de pago --------------------------------------------------------


def test_ventas_por_metodo_pago_solo_aprobados() -> None:
    pagos = [
        {"id_medio_pago": "MP-1", "medio_pago": "Efectivo", "monto": _D("100"), "estado": "aprobado"},
        {"id_medio_pago": "MP-2", "medio_pago": "Tarjeta", "monto": _D("250"), "estado": "aprobado"},
        {"id_medio_pago": "MP-1", "medio_pago": "Efectivo", "monto": _D("50"), "estado": "aprobado"},
        {"id_medio_pago": "MP-3", "medio_pago": "Cheque", "monto": _D("999"), "estado": "pendiente"},
    ]

    filas = calcular_ventas_por_metodo_pago(pagos)

    assert [fila["id_medio_pago"] for fila in filas] == ["MP-2", "MP-1"]
    assert filas[0]["monto"] == _D("250.00")
    assert filas[1]["monto"] == _D("150.00")


def test_ventas_por_metodo_pago_excluye_pagos_a_proveedor() -> None:
    pagos = [
        {"id_medio_pago": "MP-1", "medio_pago": "Efectivo", "monto": _D("100"), "estado": "aprobado"},
        {
            "id_medio_pago": "MP-1",
            "medio_pago": "Efectivo",
            "monto": _D("999"),
            "estado": "aprobado",
            "id_factura_proveedor": "FP-0001",
        },
    ]

    filas = calcular_ventas_por_metodo_pago(pagos)

    assert filas == [
        {"id_medio_pago": "MP-1", "medio_pago": "Efectivo", "monto": _D("100.00")}
    ]


# --- predicción de demanda -------------------------------------------------


def test_prediccion_demanda_historial_vacio_devuelve_ceros() -> None:
    assert predecir_demanda([], periodos=3) == [
        _D("0.000"),
        _D("0.000"),
        _D("0.000"),
    ]


def test_prediccion_demanda_historial_unico_repite_valor() -> None:
    assert predecir_demanda([_D("7")], periodos=2) == [
        _D("7.000"),
        _D("7.000"),
    ]


def test_prediccion_demanda_regresion_lineal() -> None:
    assert predecir_demanda([_D("10"), _D("20"), _D("30")], periodos=2) == [
        _D("40.000"),
        _D("50.000"),
    ]


def test_prediccion_demanda_limita_a_cero() -> None:
    assert predecir_demanda([_D("30"), _D("20"), _D("10")], periodos=3) == [
        _D("0.000"),
        _D("0.000"),
        _D("0.000"),
    ]


def test_prediccion_demanda_usa_ventana() -> None:
    assert predecir_demanda(
        [_D("100"), _D("10"), _D("20"), _D("30")],
        periodos=1,
        ventana=3,
    ) == [_D("40.000")]


def test_prediccion_demanda_periodos_cero() -> None:
    assert predecir_demanda([_D("10")], periodos=0) == []


def test_prediccion_demanda_parametros_invalidos() -> None:
    with pytest.raises(AnaliticaDatosInvalidos):
        predecir_demanda([_D("10")], periodos=-1)
    with pytest.raises(AnaliticaDatosInvalidos):
        predecir_demanda([_D("10")], periodos=1, ventana=0)


# --- variación porcentual --------------------------------------------------


def test_calcular_variacion() -> None:
    assert calcular_variacion(_D("120"), _D("100")) == _D("20.00")
    assert calcular_variacion(_D("80"), _D("100")) == _D("-20.00")
    assert calcular_variacion(_D("100"), _D("100")) == _D("0.00")
    assert calcular_variacion(_D("100"), _D("0")) is None


def test_calcular_variacion_con_base_negativa_no_invierte_el_signo() -> None:
    assert calcular_variacion(_D("-80"), _D("-100")) == _D("20.00")
    assert calcular_variacion(_D("-120"), _D("-100")) == _D("-20.00")


def test_calcular_variacion_redondea_a_dos_decimales() -> None:
    assert calcular_variacion(_D("1"), _D("3")) == _D("-66.67")
