from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from io import BytesIO
from typing import Any, Sequence

from fpdf import FPDF

_CENTAVOS = Decimal("0.01")
_GRIS = (241, 245, 249)
_OSCURO = (30, 41, 59)
_ACENTO = (37, 99, 235)
_BORDE = (203, 213, 225)


def _texto(valor: Any) -> str:
    if valor is None:
        return "-"
    return str(valor).encode("latin-1", "replace").decode("latin-1")


def _recortar(valor: Any, longitud: int = 34) -> str:
    texto = _texto(valor)
    return texto if len(texto) <= longitud else texto[: longitud - 1] + "."


def _importe(valor: Any) -> str:
    numero = Decimal(str(valor or 0)).quantize(
        _CENTAVOS, rounding=ROUND_HALF_UP
    )
    entero, decimales = f"{numero:,.2f}".split(".")
    return f"$ {entero.replace(',', '.')},{decimales}"


def _numero(valor: Any, decimales: int = 2) -> str:
    numero = Decimal(str(valor or 0))
    texto = f"{numero:,.{decimales}f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def _porcentaje(valor: Any) -> str:
    return f"{_numero(valor)}%"


def _fecha(valor: Any) -> str:
    if isinstance(valor, (date, datetime)):
        return valor.strftime("%d/%m/%Y")
    return _texto(valor)


class AnaliticaPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=16)
        self.set_margins(12, 12, 12)

    def componer(self, datos: dict[str, Any]) -> bytes:
        self.add_page()
        self._encabezado(datos)
        self._seccion_kpis(datos)
        self._seccion_tendencias(datos)
        self._seccion_clientes(datos)
        self._seccion_rankings(datos)
        self._seccion_compras(datos)
        self._seccion_inventario(datos)
        self._seccion_cobros(datos)
        self._seccion_prediccion(datos)
        self._seccion_mapa_calor(datos)

        salida = BytesIO()
        self.output(salida)
        return salida.getvalue()

    def _encabezado(self, datos: dict[str, Any]) -> None:
        parametros = datos["parametros"]
        self.set_fill_color(*_OSCURO)
        self.rect(0, 0, 210, 28, style="F")
        self.set_xy(12, 7)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 15)
        self.cell(186, 8, "Reporte Ejecutivo de Gestion", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_x(12)
        self.cell(
            186,
            6,
            _texto(
                f"Periodo: {parametros['periodo']}  |  "
                f"Desde {_fecha(datos['desde'])} hasta {_fecha(datos['hasta'])}  |  "
                f"Granularidad: {parametros['granularidad']}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_text_color(0, 0, 0)
        self.ln(3)

        filtros = [
            f"Categoria: {_texto(parametros.get('id_categoria'))}",
            f"Cliente: {_texto(parametros.get('id_cliente'))}",
            f"Proveedor: {_texto(parametros.get('id_proveedor'))}",
            f"Producto: {_texto(parametros.get('id_producto'))}",
            f"Umbral inmovilizado: {parametros['dias_inmovilizado']} dias",
            f"Top: {parametros['limite']}",
        ]
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*_OSCURO)
        self.multi_cell(
            186,
            5,
            _texto("Filtros: " + "  |  ".join(filtros)),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def _titulo(self, titulo: str) -> None:
        if self.get_y() > 255:
            self.add_page()
        self.ln(2)
        self.set_fill_color(*_GRIS)
        self.set_text_color(*_ACENTO)
        self.set_font("Helvetica", "B", 10)
        self.cell(186, 7, _texto(titulo), fill=True, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(1)

    def _tabla(
        self,
        encabezados: Sequence[str],
        filas: Sequence[Sequence[Any]],
        anchos: Sequence[float],
    ) -> None:
        if not filas:
            self.set_font("Helvetica", "I", 8)
            self.cell(186, 6, "Sin datos para los filtros seleccionados")
            self.ln()
            return
        self.set_font("Helvetica", "B", 8)
        self.set_fill_color(*_BORDE)
        for encabezado, ancho in zip(encabezados, anchos):
            self.cell(ancho, 6, _texto(encabezado), border=1, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 8)
        for fila in filas:
            if self.get_y() > 262:
                self.add_page()
            for valor, ancho in zip(fila, anchos):
                self.cell(ancho, 6, _texto(valor), border=1)
            self.ln()

    def _seccion_kpis(self, datos: dict[str, Any]) -> None:
        kpis = datos.get("kpis")
        if not kpis:
            return
        self._titulo("Indicadores principales")
        etiquetas = [
            ("Ventas (con IVA)", kpis.get("ventas"), True),
            ("Compras", kpis.get("compras"), True),
            ("Gastos recibidos", kpis.get("gastos"), True),
            ("Resultado neto", kpis.get("neto"), True),
            ("Margen neto %", kpis.get("margen_pct"), False),
            ("Costo de ventas", kpis.get("costo_ventas"), False),
            ("Margen bruto", kpis.get("margen_bruto"), False),
            ("Margen bruto %", kpis.get("margen_bruto_pct"), False),
        ]
        filas = [
            [
                etiqueta,
                _importe(valor) if es_importe else _porcentaje(valor),
            ]
            for etiqueta, valor, es_importe in etiquetas
            if valor is not None
        ]
        variacion = datos.get("variacion") or {}
        for clave, etiqueta in (
            ("ventas", "Variacion ventas %"),
            ("gastos", "Variacion gastos %"),
            ("neto", "Variacion neto %"),
        ):
            if variacion.get(clave) is not None:
                filas.append([etiqueta, _porcentaje(variacion[clave])])
        self._tabla(["Indicador", "Valor"], filas, [110, 76])

    def _seccion_tendencias(self, datos: dict[str, Any]) -> None:
        puntos = datos.get("tendencias") or []
        if not puntos:
            return
        self._titulo("Tendencias")
        filas = [
            [
                _fecha(punto["inicio"]),
                _fecha(punto["fin"]),
                _importe(punto["ventas"]),
                _importe(punto["gastos"]),
            ]
            for punto in puntos[:30]
        ]
        if len(puntos) > 30:
            filas.append(["...", f"{len(puntos) - 30} periodos mas", "", ""])
        self._tabla(
            ["Desde", "Hasta", "Ventas", "Gastos"],
            filas,
            [32, 32, 61, 61],
        )

    def _seccion_clientes(self, datos: dict[str, Any]) -> None:
        resumen = datos.get("resumen_nuevos_recurrentes")
        if resumen:
            self._titulo("Clientes nuevos vs recurrentes")
            self._tabla(
                ["Total del periodo", "Nuevos %", "Recurrentes %"],
                [
                    [
                        _importe(resumen["total"]),
                        _porcentaje(resumen["nuevos_pct"]),
                        _porcentaje(resumen["recurrentes_pct"]),
                    ]
                ],
                [62, 62, 62],
            )

    def _seccion_rankings(self, datos: dict[str, Any]) -> None:
        for clave, titulo in (
            ("ranking_productos", "Productos mas vendidos"),
            ("productos_menos_vendidos", "Productos menos vendidos"),
            ("productos_mas_rentables", "Productos mas rentables"),
        ):
            filas = datos.get(clave) or []
            if not filas:
                continue
            self._titulo(titulo)
            self._tabla(
                ["Producto", "Cant.", "Venta neta", "Margen", "Margen %"],
                [
                    [
                        _recortar(fila["nombre"]),
                        _numero(fila["cantidad"], 3),
                        _importe(fila["venta_neta"]),
                        _importe(fila["margen"]),
                        _porcentaje(fila["margen_pct"]),
                    ]
                    for fila in filas
                ],
                [52, 20, 38, 38, 38],
            )

        clientes = datos.get("ranking_clientes") or []
        if clientes:
            self._titulo("Clientes por facturacion")
            self._tabla(
                ["Cliente", "Pedidos", "Facturacion"],
                [
                    [
                        _recortar(fila["nombre"]),
                        fila["pedidos"],
                        _importe(fila["facturacion"]),
                    ]
                    for fila in clientes
                ],
                [96, 30, 60],
            )

    def _seccion_compras(self, datos: dict[str, Any]) -> None:
        proveedores = datos.get("ranking_proveedores") or []
        if proveedores:
            self._titulo("Proveedores por volumen")
            self._tabla(
                ["Proveedor", "Pedidos", "Volumen", "Precio prom.", "Entrega"],
                [
                    [
                        _recortar(fila["nombre"]),
                        fila["pedidos"],
                        _importe(fila["volumen_compra"]),
                        _importe(fila["precio_promedio"]),
                        _numero(fila["entrega_promedio_dias"])
                        if fila.get("entrega_promedio_dias") is not None
                        else "-",
                    ]
                    for fila in proveedores
                ],
                [50, 20, 40, 40, 36],
            )

        comparativa = datos.get("comparativa_precios") or []
        if comparativa:
            self._titulo("Comparativa de precios")
            filas: list[list[Any]] = []
            for fila in comparativa:
                for proveedor in fila["proveedores"]:
                    filas.append(
                        [
                            _recortar(fila["nombre"]),
                            _recortar(proveedor["proveedor"]),
                            _importe(proveedor["precio_minimo"]),
                            _importe(proveedor["precio_promedio"]),
                        ]
                    )
            self._tabla(
                ["Producto", "Proveedor", "Precio min.", "Precio prom."],
                filas,
                [50, 50, 43, 43],
            )

    def _seccion_inventario(self, datos: dict[str, Any]) -> None:
        filas = datos.get("inventario_inmovilizado") or []
        if not filas:
            return
        self._titulo("Inventario inmovilizado")
        resumen = datos.get("resumen_inventario_inmovilizado") or {}
        self.set_font("Helvetica", "", 8)
        self.cell(
            186,
            6,
            _texto(
                f"Productos detectados: {resumen.get('productos', len(filas))}  |  "
                f"Capital inmovilizado: {_importe(resumen.get('capital', 0))}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self._tabla(
            ["Producto", "Dias sin venta", "Stock", "Capital", "Liquidar"],
            [
                [
                    _recortar(fila["nombre"]),
                    fila["dias_sin_venta"]
                    if fila["dias_sin_venta"] is not None
                    else "Nunca",
                    _numero(fila["stock"], 3),
                    _importe(fila["capital"]),
                    "Si" if fila.get("sugerencia_liquidar") else "No",
                ]
                for fila in filas
            ],
            [52, 30, 28, 48, 28],
        )

    def _seccion_cobros(self, datos: dict[str, Any]) -> None:
        filas = datos.get("medios_pago") or []
        if not filas:
            return
        self._titulo("Cobros por medio de pago")
        resumen = datos.get("resumen_medios_pago") or {}
        self.set_font("Helvetica", "", 8)
        self.cell(
            186,
            6,
            _texto(f"Total cobrado: {_importe(resumen.get('total_cobrado', 0))}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self._tabla(
            ["Medio de pago", "Monto", "Participacion"],
            [
                [
                    _recortar(fila["medio_pago"]),
                    _importe(fila["monto"]),
                    _porcentaje(fila["participacion_pct"]),
                ]
                for fila in filas
            ],
            [76, 55, 55],
        )

    def _seccion_prediccion(self, datos: dict[str, Any]) -> None:
        filas = datos.get("prediccion_demanda") or []
        if not filas:
            return
        self._titulo("Prediccion de demanda")
        self._tabla(
            ["Producto", "Historial", "Pronostico"],
            [
                [
                    _recortar(fila["nombre"], 28),
                    " / ".join(_numero(valor, 1) for valor in fila["historial"]),
                    " / ".join(_numero(valor, 1) for valor in fila["pronostico"]),
                ]
                for fila in filas
            ],
            [40, 86, 60],
        )

    def _seccion_mapa_calor(self, datos: dict[str, Any]) -> None:
        mapa = datos.get("mapa_calor")
        if not mapa:
            return
        self._titulo("Mapa de calor de ventas")
        dias = mapa["dias"]
        nombres_dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
        encabezados = ["Hora"] + [
            nombres_dias[dia] if 0 <= dia < len(nombres_dias) else _texto(dia)
            for dia in dias
        ]
        anchos = [26] + [160 / len(dias)] * len(dias)
        filas = []
        for indice, hora in enumerate(mapa["horas"]):
            filas.append(
                [f"{hora:02d} hs"]
                + [
                    _numero(mapa["valores"][columna][indice], 0)
                    for columna in range(len(dias))
                ]
            )
        self._tabla(encabezados, filas, anchos)


def generar_pdf_analitica(datos: dict[str, Any]) -> bytes:
    """Genera el PDF del reporte con los datos ya calculados por el backend."""
    return AnaliticaPDF().componer(datos)
