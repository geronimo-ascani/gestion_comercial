"""PDF del reporte de cobros y pagos (RF-28: solo PDF, generado en backend)."""

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from io import BytesIO
from typing import Any, Sequence

from fpdf import FPDF

_CENTAVOS = Decimal("0.01")
_GRIS = (241, 245, 249)
_OSCURO = (30, 41, 59)
_BORDE = (203, 213, 225)


def _texto(valor: Any) -> str:
    if valor is None:
        return "-"
    return str(valor).encode("latin-1", "replace").decode("latin-1")


def _importe(valor: Any) -> str:
    numero = Decimal(str(valor or 0)).quantize(
        _CENTAVOS, rounding=ROUND_HALF_UP
    )
    entero, decimales = f"{numero:,.2f}".split(".")
    return f"$ {entero.replace(',', '.')},{decimales}"


def _fecha(valor: Any) -> str:
    if isinstance(valor, (date, datetime)):
        return valor.strftime("%d/%m/%Y")
    return _texto(valor)


class ReporteCobrosPagosPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=16)
        self.set_margins(12, 12, 12)

    def componer(self, datos: dict[str, Any]) -> bytes:
        self.add_page()
        self._encabezado(datos)
        self._seccion_totales(datos.get("totales") or {})
        self._seccion_estados(datos.get("por_estado") or [])
        self._seccion_medios(datos.get("por_medio_pago") or [])

        salida = BytesIO()
        self.output(salida)
        return salida.getvalue()

    def _encabezado(self, datos: dict[str, Any]) -> None:
        parametros = datos.get("parametros") or {}
        self.set_fill_color(*_OSCURO)
        self.rect(0, 0, 210, 28, style="F")
        self.set_xy(12, 7)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 15)
        self.cell(
            186,
            8,
            _texto("Reporte de cobros y pagos"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_font("Helvetica", "", 9)
        self.set_x(12)
        self.cell(
            186,
            6,
            _texto(
                f"Desde {_fecha(datos.get('desde'))} "
                f"hasta {_fecha(datos.get('hasta'))}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_text_color(0, 0, 0)

        filtros = [
            f"Cliente: {_texto(parametros.get('id_cliente'))}",
            f"Proveedor: {_texto(parametros.get('id_proveedor'))}",
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
        if self.get_y() > 250:
            self.add_page()
        self.ln(2)
        self.set_fill_color(*_GRIS)
        self.set_text_color(*_OSCURO)
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

    def _seccion_totales(self, totales: dict[str, Any]) -> None:
        self._titulo("Totales del periodo")
        filas = [
            ["Cobros aprobados", _importe(totales.get("cobros_aprobados"))],
            ["Cobros pendientes", _importe(totales.get("cobros_pendientes"))],
            ["Cobros rechazados", _importe(totales.get("cobros_rechazados"))],
            ["Pagos aprobados", _importe(totales.get("pagos_aprobados"))],
            ["Pagos pendientes", _importe(totales.get("pagos_pendientes"))],
            ["Pagos rechazados", _importe(totales.get("pagos_rechazados"))],
            ["Neto realizado", _importe(totales.get("neto_realizado"))],
        ]
        self._tabla(["Concepto", "Importe"], filas, [120, 66])

    def _seccion_estados(self, filas: Sequence[dict[str, Any]]) -> None:
        self._titulo("Totales por estado")
        tabla = [
            [
                fila["estado"],
                _importe(fila["cobros"]["monto"]),
                fila["cobros"]["cantidad"],
                _importe(fila["pagos"]["monto"]),
                fila["pagos"]["cantidad"],
            ]
            for fila in filas
        ]
        self._tabla(
            ["Estado", "Cobros", "Cant.", "Pagos", "Cant."],
            tabla,
            [30, 44, 16, 44, 16],
        )

    def _seccion_medios(self, filas: Sequence[dict[str, Any]]) -> None:
        self._titulo("Totales por medio de pago")
        tabla = [
            [
                fila["medio_pago"],
                _importe(fila["cobros_aprobados"]),
                _importe(fila["pagos_aprobados"]),
                _importe(fila["total_aprobado"]),
            ]
            for fila in filas
        ]
        self._tabla(
            ["Medio de pago", "Cobros", "Pagos", "Total aprobado"],
            tabla,
            [56, 42, 42, 46],
        )


def generar_pdf_reporte_cobros_pagos(datos: dict[str, Any]) -> bytes:
    return ReporteCobrosPagosPDF().componer(datos)
