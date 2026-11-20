from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from app.repositories.analitica_repository import AnaliticaRepository
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

Granularidad = Literal["diario", "semanal", "mensual"]

_LIMITE_RANKING = 10
_LIMITE_COMPARATIVA = 8
_LIMITE_PREDICCION = 5
_MESES_DEMANDA = 6

_ROLES = {"administrador", "ventas", "abastecimiento"}


class AnaliticaService:
    def __init__(self, repo: AnaliticaRepository) -> None:
        self._repo = repo

    def obtener(
        self,
        periodo: str,
        rol: str,
        referencia: date | None = None,
    ) -> dict[str, Any]:
        if rol not in _ROLES:
            raise AnaliticaDatosInvalidos(
                f"El rol '{rol}' no puede acceder a las analíticas"
            )

        hoy = referencia or date.today()
        desde, hasta = rango_periodo(periodo, hoy)  # type: ignore[arg-type]
        granularidad = _granularidad(periodo)
        es_admin = rol == "administrador"
        ve_ventas = rol in ("administrador", "ventas")
        ve_compras = rol in ("administrador", "abastecimiento")

        datos: dict[str, Any] = {
            "periodo": periodo,
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime.now(timezone.utc),
        }

        ventas = self._repo.listar_ventas(desde, hasta) if ve_ventas else []
        compras_pedido = (
            self._repo.listar_compras(desde, hasta) if ve_compras else []
        )
        compras_recibidas = (
            self._repo.listar_compras(desde, hasta, por_recepcion=True)
            if es_admin
            else []
        )

        if ve_ventas:
            kpis = calcular_kpis(
                ventas,
                compras_pedido,
                compras_recibidas,
            )
            if es_admin:
                datos["kpis"] = kpis
            else:
                # Costos y margen bruto se calculan desde el costo guardado en
                # cada venta, así que pueden mostrarse a ventas.
                # El margen neto (`margen_pct`) depende de los gastos de compra
                # y permanece oculto junto a compras/gastos/neto.
                datos["kpis"] = {
                    "ventas": kpis["ventas"],
                    "compras": None,
                    "gastos": None,
                    "neto": None,
                    "margen_pct": None,
                    "costo_ventas": kpis["costo_ventas"],
                    "margen_bruto": kpis["margen_bruto"],
                    "margen_bruto_pct": kpis["margen_bruto_pct"],
                }

            tendencias = calcular_tendencias(
                ventas,
                compras_recibidas if es_admin else [],
                granularidad,
                desde,
                hasta,
            )
            datos["tendencias"] = [
                {
                    **punto,
                    "gastos": punto["gastos"] if es_admin else None,
                }
                for punto in tendencias
            ]

            aov_upt = calcular_aov_upt_por_periodo(
                ventas, granularidad, desde, hasta
            )
            datos["aov_upt"] = aov_upt
            datos["aov_upt_actual"] = calcular_aov_upt(ventas)

            primeras = self._repo.listar_primeras_compras()
            datos["nuevos_recurrentes"] = calcular_nuevos_vs_recurrentes(
                ventas, primeras, granularidad, desde, hasta
            )

            datos["ranking_productos"] = calcular_ranking_productos(
                ventas, limite=_LIMITE_RANKING
            )
            datos["ranking_clientes"] = calcular_ranking_clientes(
                ventas, limite=_LIMITE_RANKING
            )
            datos["margen_categorias"] = calcular_margen_por_categoria(ventas)
            datos["mapa_calor"] = calcular_mapa_calor(ventas)

            datos["variacion"] = self._variacion(
                periodo, desde, hasta, kpis, solo_ventas=not es_admin
            )

        if ve_compras:
            datos["ranking_proveedores"] = calcular_ranking_proveedores(
                compras_pedido, limite=_LIMITE_RANKING
            )
            datos["comparativa_precios"] = calcular_comparativa_precios(
                compras_pedido
            )[:_LIMITE_COMPARATIVA]

            productos = self._repo.listar_inventario()
            ultima_venta = self._repo.listar_ultima_venta()
            datos["inventario_inmovilizado"] = (
                calcular_inventario_inmovilizado(
                    productos, ultima_venta, hasta
                )
            )

        if es_admin:
            pagos = self._repo.listar_pagos(desde, hasta)
            datos["medios_pago"] = calcular_ventas_por_metodo_pago(pagos)

        datos["prediccion_demanda"] = self._predecir_demanda(hasta)

        return datos

    def _variacion(
        self,
        periodo: str,
        desde: date,
        hasta: date,
        kpis: dict[str, Any],
        *,
        solo_ventas: bool,
    ) -> dict[str, Decimal | None]:
        anterior_desde, anterior_hasta = rango_comparacion(
            periodo, desde, hasta  # type: ignore[arg-type]
        )
        anterior = self._repo.totales(anterior_desde, anterior_hasta)

        variacion = {
            "ventas": calcular_variacion(kpis["ventas"], anterior["ventas"]),
            "gastos": None,
            "neto": None,
        }
        if not solo_ventas:
            variacion["gastos"] = calcular_variacion(
                kpis["gastos"], anterior["gastos"]
            )
            variacion["neto"] = calcular_variacion(
                kpis["neto"], anterior["ventas"] - anterior["gastos"]
            )
        return variacion

    def _predecir_demanda(self, hasta: date) -> list[dict[str, Any]]:
        inicio_mes = _mes_inicial(hasta, _MESES_DEMANDA - 1)
        filas = self._repo.listar_historial_demanda(inicio_mes, hasta)
        meses = _meses_entre(inicio_mes, hasta)

        productos: dict[str, dict[str, Any]] = {}
        for fila in filas:
            producto = productos.setdefault(
                fila["id_producto"],
                {
                    "nombre": fila["nombre"],
                    "cantidades": {},
                    "total": Decimal("0"),
                },
            )
            producto["cantidades"][fila["mes"]] = fila["cantidad"]
            producto["total"] += fila["cantidad"]

        ordenados = sorted(
            productos.items(),
            key=lambda item: (-item[1]["total"], item[1]["nombre"]),
        )[:_LIMITE_PREDICCION]

        return [
            {
                "id_producto": id_producto,
                "nombre": datos["nombre"],
                "historial": [
                    datos["cantidades"].get(mes, Decimal("0"))
                    for mes in meses
                ],
                "pronostico": predecir_demanda(
                    [
                        datos["cantidades"].get(mes, Decimal("0"))
                        for mes in meses
                    ],
                    periodos=1,
                ),
            }
            for id_producto, datos in ordenados
        ]


def _granularidad(periodo: str) -> Granularidad:
    if periodo in ("hoy", "7d", "mes"):
        return "diario"
    if periodo == "trimestre":
        return "semanal"
    return "mensual"


def _mes_inicial(fecha: date, meses_atras: int) -> date:
    total = fecha.year * 12 + (fecha.month - 1) - meses_atras
    return date(total // 12, total % 12 + 1, 1)


def _meses_entre(desde: date, hasta: date) -> list[date]:
    meses: list[date] = []
    actual = date(desde.year, desde.month, 1)
    limite = date(hasta.year, hasta.month, 1)
    while actual <= limite:
        meses.append(actual)
        actual = _mes_inicial(actual, -1)
    return meses
