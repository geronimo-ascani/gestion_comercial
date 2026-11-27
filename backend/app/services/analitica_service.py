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
    filtrar_compras,
    filtrar_inventario,
    filtrar_pagos,
    filtrar_ventas,
    predecir_demanda,
    rango_comparacion,
    rango_comparacion_personalizado,
    rango_periodo,
    resumen_inventario_inmovilizado,
    resumen_medios_pago,
    resumen_nuevos_recurrentes,
)

Granularidad = Literal["diario", "semanal", "mensual", "anual"]

_LIMITE_RANKING = 10
_LIMITE_MAXIMO = 50
_LIMITE_COMPARATIVA = 8
_LIMITE_PREDICCION = 5
_MESES_DEMANDA = 6
_MAX_DIAS_INMOVILIZADO = 365
_MAX_PERIODOS_PRONOSTICO = 6

_ROLES = {"administrador", "ventas", "abastecimiento"}


class AnaliticaService:
    def __init__(self, repo: AnaliticaRepository) -> None:
        self._repo = repo

    def obtener(
        self,
        periodo: str,
        rol: str,
        referencia: date | None = None,
        *,
        desde: date | None = None,
        hasta: date | None = None,
        granularidad: Granularidad | None = None,
        limite: int = _LIMITE_RANKING,
        dias_inmovilizado: int = 0,
        id_categoria: str | None = None,
        id_cliente: str | None = None,
        id_proveedor: str | None = None,
        id_producto: str | None = None,
        periodos_pronostico: int = 1,
    ) -> dict[str, Any]:
        if rol not in _ROLES:
            raise AnaliticaDatosInvalidos(
                f"El rol '{rol}' no puede acceder a las analíticas"
            )
        self._validar_parametros(
            limite=limite,
            dias_inmovilizado=dias_inmovilizado,
            desde=desde,
            hasta=hasta,
            periodos_pronostico=periodos_pronostico,
        )

        hoy = referencia or date.today()
        rango_desde, rango_hasta = rango_periodo(periodo, hoy)  # type: ignore[arg-type]
        rango_personalizado = desde is not None and hasta is not None
        desde = desde or rango_desde
        hasta = hasta or rango_hasta
        granularidad = granularidad or _granularidad(periodo)

        es_admin = rol == "administrador"
        ve_ventas = rol in ("administrador", "ventas")
        ve_compras = rol in ("administrador", "abastecimiento")

        datos: dict[str, Any] = {
            "periodo": periodo,
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime.now(timezone.utc),
            "parametros": {
                "periodo": periodo,
                "desde": desde,
                "hasta": hasta,
                "granularidad": granularidad,
                "limite": limite,
                "dias_inmovilizado": dias_inmovilizado,
                "id_categoria": id_categoria,
                "id_cliente": id_cliente,
                "id_proveedor": id_proveedor,
                "id_producto": id_producto,
                "periodos_pronostico": periodos_pronostico,
            },
        }

        ventas = self._ventas(desde, hasta, id_categoria, id_cliente)
        compras_pedido = (
            self._compras(desde, hasta, id_categoria, id_proveedor)
            if ve_compras
            else []
        )
        compras_recibidas = (
            self._compras(
                desde,
                hasta,
                id_categoria,
                id_proveedor,
                por_recepcion=True,
            )
            if es_admin
            else []
        )
        ids_producto_comprados = {
            item["id_producto"]
            for compra in compras_pedido
            for item in compra["items"]
        } if id_proveedor else None

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
                # cada venta, así que pueden mostrarse a ventas. El margen neto
                # depende de los gastos de compra y permanece oculto.
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

            datos["tendencias"] = [
                {
                    **punto,
                    "gastos": punto["gastos"] if es_admin else None,
                }
                for punto in calcular_tendencias(
                    ventas,
                    compras_recibidas if es_admin else [],
                    granularidad,
                    desde,
                    hasta,
                )
            ]
            datos["aov_upt"] = calcular_aov_upt_por_periodo(
                ventas, granularidad, desde, hasta
            )
            datos["aov_upt_actual"] = calcular_aov_upt(ventas)

            primeras = self._repo.listar_primeras_compras()
            if id_cliente:
                primeras = {
                    cliente: primera
                    for cliente, primera in primeras.items()
                    if cliente == id_cliente
                }
            datos["nuevos_recurrentes"] = calcular_nuevos_vs_recurrentes(
                ventas, primeras, granularidad, desde, hasta
            )
            datos["resumen_nuevos_recurrentes"] = resumen_nuevos_recurrentes(
                datos["nuevos_recurrentes"]
            )

            datos["ranking_productos"] = calcular_ranking_productos(
                ventas, limite=limite
            )
            datos["productos_menos_vendidos"] = calcular_ranking_productos(
                ventas, limite=limite, orden="asc"
            )
            datos["productos_mas_rentables"] = calcular_ranking_productos(
                ventas, limite=limite, orden="margen_desc"
            )
            datos["ranking_clientes"] = calcular_ranking_clientes(
                ventas, limite=limite
            )
            datos["margen_categorias"] = calcular_margen_por_categoria(ventas)
            datos["mapa_calor"] = calcular_mapa_calor(ventas)

            datos["variacion"] = self._variacion(
                periodo,
                desde,
                hasta,
                kpis,
                solo_ventas=not es_admin,
                rango_personalizado=rango_personalizado,
                id_categoria=id_categoria,
                id_cliente=id_cliente,
                id_proveedor=id_proveedor,
            )

        if ve_compras:
            datos["ranking_proveedores"] = calcular_ranking_proveedores(
                compras_pedido, limite=limite
            )
            datos["comparativa_precios"] = calcular_comparativa_precios(
                compras_pedido
            )[:_LIMITE_COMPARATIVA]

            productos = filtrar_inventario(
                self._repo.listar_inventario(),
                id_categoria=id_categoria,
                ids_producto=ids_producto_comprados,
            )
            ultima_venta = self._repo.listar_ultima_venta(id_cliente)
            inmovilizado = calcular_inventario_inmovilizado(
                productos,
                ultima_venta,
                hasta,
                dias_minimos=dias_inmovilizado,
            )
            datos["inventario_inmovilizado"] = inmovilizado
            datos["resumen_inventario_inmovilizado"] = (
                resumen_inventario_inmovilizado(inmovilizado)
            )

        if es_admin:
            pagos = filtrar_pagos(
                self._repo.listar_pagos(desde, hasta),
                id_cliente=id_cliente,
                # Sin filtro de categoría se respeta la fecha de cobro, no la
                # del pedido original: un comprobante antiguo puede pagarse hoy.
                ids_pedido=(
                    {venta["id_pedido"] for venta in ventas}
                    if id_categoria
                    else None
                ),
            )
            datos["medios_pago"] = calcular_ventas_por_metodo_pago(pagos)
            datos["resumen_medios_pago"] = resumen_medios_pago(
                datos["medios_pago"]
            )

        datos["prediccion_demanda"] = self._predecir_demanda(
            hasta,
            id_producto=id_producto,
            id_categoria=id_categoria,
            ids_producto=ids_producto_comprados,
            periodos=periodos_pronostico,
        )

        return datos

    def _validar_parametros(
        self,
        *,
        limite: int,
        dias_inmovilizado: int,
        desde: date | None,
        hasta: date | None,
        periodos_pronostico: int,
    ) -> None:
        if not 1 <= limite <= _LIMITE_MAXIMO:
            raise AnaliticaDatosInvalidos(
                f"'limite' debe estar entre 1 y {_LIMITE_MAXIMO}"
            )
        if not 0 <= dias_inmovilizado <= _MAX_DIAS_INMOVILIZADO:
            raise AnaliticaDatosInvalidos(
                "'dias_inmovilizado' debe estar entre 0 y "
                f"{_MAX_DIAS_INMOVILIZADO}"
            )
        if not 1 <= periodos_pronostico <= _MAX_PERIODOS_PRONOSTICO:
            raise AnaliticaDatosInvalidos(
                "'periodos_pronostico' debe estar entre 1 y "
                f"{_MAX_PERIODOS_PRONOSTICO}"
            )
        if (desde is None) != (hasta is None):
            raise AnaliticaDatosInvalidos(
                "'desde' y 'hasta' deben enviarse juntos"
            )
        if desde is not None and hasta is not None and hasta < desde:
            raise AnaliticaDatosInvalidos(
                "'desde' no puede ser posterior a 'hasta'"
            )

    def _ventas(
        self,
        desde: date,
        hasta: date,
        id_categoria: str | None,
        id_cliente: str | None,
    ) -> list[dict[str, Any]]:
        return filtrar_ventas(  # type: ignore[return-value]
            self._repo.listar_ventas(desde, hasta),
            id_cliente=id_cliente,
            id_categoria=id_categoria,
        )

    def _compras(
        self,
        desde: date,
        hasta: date,
        id_categoria: str | None,
        id_proveedor: str | None,
        *,
        por_recepcion: bool = False,
    ) -> list[dict[str, Any]]:
        return filtrar_compras(  # type: ignore[return-value]
            self._repo.listar_compras(
                desde, hasta, por_recepcion=por_recepcion
            ),
            id_proveedor=id_proveedor,
            id_categoria=id_categoria,
        )

    def _variacion(
        self,
        periodo: str,
        desde: date,
        hasta: date,
        kpis: dict[str, Any],
        *,
        solo_ventas: bool,
        rango_personalizado: bool,
        id_categoria: str | None,
        id_cliente: str | None,
        id_proveedor: str | None,
    ) -> dict[str, Decimal | None]:
        if rango_personalizado:
            anterior_desde, anterior_hasta = (
                rango_comparacion_personalizado(desde, hasta)
            )
        else:
            anterior_desde, anterior_hasta = rango_comparacion(
                periodo, desde, hasta  # type: ignore[arg-type]
            )
        anterior = self._repo.totales(
            anterior_desde,
            anterior_hasta,
            id_cliente=id_cliente,
            id_proveedor=id_proveedor,
            id_categoria=id_categoria,
        )

        variacion: dict[str, Decimal | None] = {
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

    def _predecir_demanda(
        self,
        hasta: date,
        *,
        id_producto: str | None,
        id_categoria: str | None,
        ids_producto: set[str] | None,
        periodos: int,
    ) -> list[dict[str, Any]]:
        inicio_mes = _mes_inicial(hasta, _MESES_DEMANDA - 1)
        filas = self._repo.listar_historial_demanda(
            inicio_mes, hasta, id_producto
        )
        meses = _meses_entre(inicio_mes, hasta)

        productos: dict[str, dict[str, Any]] = {}
        for fila in filas:
            if id_categoria and fila.get("id_categoria") != id_categoria:
                continue
            if ids_producto is not None and fila["id_producto"] not in ids_producto:
                continue
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
        )
        if id_producto is None:
            ordenados = ordenados[:_LIMITE_PREDICCION]

        return [
            {
                "id_producto": id_producto_fila,
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
                    periodos=periodos,
                ),
            }
            for id_producto_fila, datos in ordenados
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
