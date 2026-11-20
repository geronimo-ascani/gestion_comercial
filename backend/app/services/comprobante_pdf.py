from decimal import ROUND_HALF_UP, Decimal
from io import BytesIO
from typing import Any

from fpdf import FPDF

_GRIS = (241, 245, 249)
_OSCURO = (30, 41, 59)
_ACENTO = (37, 99, 235)
_BORDE = (203, 213, 225)

_ESTADOS_PAGO = {
    "emitida": "Pendiente de pago",
    "aprobada": "Pago parcial",
    "pagada": "Pagada",
    "rechazada": "Rechazada",
}

_CONDICIONES = {
    "responsable_inscripto": "IVA Responsable Inscripto",
    "monotributista": "Responsable Monotributo",
    "exento": "IVA Sujeto Exento",
}


def _texto(valor: Any) -> str:
    if valor is None:
        return ""
    return str(valor).encode("latin-1", "replace").decode("latin-1")


def _importe(valor: Any) -> str:
    numero = Decimal(str(valor or 0)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    entero, decimales = f"{numero:,.2f}".split(".")
    return f"$ {entero.replace(',', '.')},{decimales}"


def _cantidad(valor: Any) -> str:
    numero = Decimal(str(valor or 0)).quantize(
        Decimal("0.001"), rounding=ROUND_HALF_UP
    )
    return f"{numero:.3f}".replace(".", ",")


def _fecha(valor: Any) -> str:
    if not valor:
        return "-"
    return valor.strftime("%d/%m/%Y")


class ComprobantePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(12, 12, 12)

    def componer(self, comprobante: dict[str, Any]) -> bytes:
        self.add_page()
        self._encabezado(comprobante)
        self._partes(comprobante)
        self._items(comprobante)
        self._totales(comprobante)
        self._pagos(comprobante)
        self._pie(comprobante)
        salida = BytesIO()
        self.output(salida)
        return salida.getvalue()

    def _encabezado(self, comprobante: dict[str, Any]) -> None:
        empresa = comprobante["empresa"]
        self.set_fill_color(*_OSCURO)
        self.rect(0, 0, 210, 30, style="F")

        self.set_xy(12, 7)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 15)
        self.cell(120, 8, _texto(empresa["razon_social"]), new_x="LMARGIN", new_y="NEXT")
        self.set_x(12)
        self.set_font("Helvetica", "", 9)
        self.cell(
            120,
            5,
            _texto(
                f"CUIT {empresa['cuit'] or '-'} | "
                f"{_CONDICIONES.get(empresa['condicion_iva'], empresa['condicion_iva'])}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.set_xy(130, 6)
        self.set_font("Helvetica", "B", 12)
        self.cell(
            68,
            7,
            _texto(f"COMPROBANTE {comprobante['tipo_comprobante']}"),
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_xy(130, 13)
        self.set_font("Helvetica", "", 9)
        self.cell(
            68,
            5,
            _texto(comprobante["numero_completo"] or "Sin numerar"),
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_xy(130, 18)
        self.cell(
            68,
            5,
            _texto(f"Fecha: {_fecha(comprobante['fecha_emision'])}"),
            align="R",
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.set_text_color(0, 0, 0)
        self.set_xy(12, 34)
        self.set_font("Helvetica", "", 8)
        domicilio = empresa["domicilio"] or "Domicilio no informado"
        self.cell(
            95,
            4,
            _texto(f"{domicilio} | {empresa['email'] or 'sin email'}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_x(12)
        self.cell(
            95,
            4,
            _texto(f"Tel. {empresa['telefono'] or '-'}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )

        self.set_xy(12, 44)
        self.set_font("Helvetica", "B", 10)
        self.cell(0, 5, "Cliente", new_x="LMARGIN", new_y="NEXT")
        cliente = comprobante["cliente"]
        self.set_font("Helvetica", "", 9)
        self.set_x(12)
        self.cell(
            120,
            5,
            _texto(f"{cliente['apellido']}, {cliente['nombre']}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_x(12)
        self.cell(
            120,
            5,
            _texto(
                f"DNI/CUIT {cliente['dni_cuit'] or '-'} | "
                f"{cliente['condicion_iva_descripcion']}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_x(12)
        self.cell(
            120,
            5,
            _texto(f"{cliente['email'] or 'sin email'} | Tel. {cliente['telefono'] or '-'}"),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.set_x(12)
        self.cell(
            0,
            5,
            _texto(
                "Entrega: "
                f"{comprobante['entrega_calle']} {comprobante['entrega_altura']}, "
                f"{comprobante['entrega_localidad']}, "
                f"{comprobante['entrega_provincia']}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )

    def _partes(self, comprobante: dict[str, Any]) -> None:
        self.ln(3)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 116, 139)
        self.cell(
            0,
            5,
            _texto(
                f"Pedido {comprobante['id_pedido_cliente']} | "
                f"Pago: {_ESTADOS_PAGO.get(comprobante['estado_pago'], comprobante['estado_pago'])}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        if comprobante["observaciones"]:
            self.multi_cell(
                0, 4, _texto(f"Observaciones: {comprobante['observaciones']}")
            )
        self.set_text_color(0, 0, 0)

    def _items(self, comprobante: dict[str, Any]) -> None:
        self.ln(3)
        columnas = (
            ("Producto", 58, "L"),
            ("Cant.", 14, "R"),
            ("P. unit.", 24, "R"),
            ("Desc.", 14, "R"),
            ("IVA", 22, "R"),
            ("Subtotal", 26, "R"),
            ("Total", 28, "R"),
        )
        self.set_font("Helvetica", "B", 8)
        self.set_fill_color(*_GRIS)
        self.set_draw_color(*_BORDE)
        for titulo, ancho, alineacion in columnas:
            self.cell(ancho, 7, titulo, border=1, align=alineacion, fill=True)
        self.ln()

        self.set_font("Helvetica", "", 8)
        for item in comprobante["items"]:
            if self.get_y() > 250:
                self.add_page()
            total_linea = (
                Decimal(str(item["neto"])) + Decimal(str(item["iva"]))
            ).quantize(Decimal("0.01"))
            valores = (
                item["producto_nombre"],
                _cantidad(item["cantidad"]),
                _importe(item["precio_unitario"]),
                f"{Decimal(str(item['descuento_producto'])):.2f}%".replace(
                    ".", ","
                ),
                _importe(item["iva"]),
                _importe(item["neto"]),
                _importe(total_linea),
            )
            for (_, ancho, alineacion), valor in zip(columnas, valores):
                self.cell(
                    ancho,
                    6,
                    _texto(valor),
                    border=1,
                    align=alineacion,
                )
            self.ln()

    def _totales(self, comprobante: dict[str, Any]) -> None:
        neto = sum(
            (Decimal(str(item["neto"])) for item in comprobante["items"]),
            Decimal("0"),
        )
        iva = sum(
            (Decimal(str(item["iva"])) for item in comprobante["items"]),
            Decimal("0"),
        )
        self.ln(2)
        filas = (
            ("Neto gravado", neto),
            ("IVA", iva),
            ("Total", Decimal(str(comprobante["monto"]))),
            ("Pagado", Decimal(str(comprobante["total_pagado"]))),
            ("Saldo pendiente", Decimal(str(comprobante["saldo_pendiente"]))),
        )
        for indice, (etiqueta, valor) in enumerate(filas):
            negrita = "B" if etiqueta in ("Total", "Saldo pendiente") else ""
            self.set_font("Helvetica", negrita, 9)
            self.set_x(120)
            self.cell(38, 6, _texto(etiqueta), align="R")
            self.cell(40, 6, _importe(valor), align="R", border="B")
            self.ln()

    def _pagos(self, comprobante: dict[str, Any]) -> None:
        pagos = comprobante["pagos"]
        if not pagos:
            return
        self.ln(4)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 5, "Pagos registrados", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "B", 8)
        self.set_fill_color(*_GRIS)
        for titulo, ancho, alineacion in (
            ("Fecha", 24, "L"),
            ("Medio", 48, "L"),
            ("Referencia", 52, "L"),
            ("Estado", 30, "L"),
            ("Monto", 32, "R"),
        ):
            self.cell(ancho, 6, titulo, border=1, align=alineacion, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 8)
        for pago in pagos:
            for valor, ancho, alineacion in (
                (_fecha(pago["fecha_pago"]), 24, "L"),
                (pago["medio_pago"], 48, "L"),
                (pago["referencia"] or "-", 52, "L"),
                (pago["estado"], 30, "L"),
                (_importe(pago["monto"]), 32, "R"),
            ):
                self.cell(ancho, 5, _texto(valor), border=1, align=alineacion)
            self.ln()

    def _pie(self, comprobante: dict[str, Any]) -> None:
        self.set_y(-24)
        self.set_draw_color(*_BORDE)
        self.line(12, self.get_y(), 198, self.get_y())
        self.set_y(-20)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(100, 116, 139)
        if comprobante["cae"]:
            self.cell(
                0,
                4,
                _texto(
                    f"CAE {comprobante['cae']} | Vencimiento "
                    f"{_fecha(comprobante['cae_vence'])}"
                ),
                new_x="LMARGIN",
                new_y="NEXT",
            )
        self.cell(
            0,
            4,
            _texto(
                "Documento interno generado por el sistema. "
                "No válido como factura hasta la integración con ARCA."
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )
        self.cell(
            0,
            4,
            _texto(
                f"{comprobante['empresa']['razon_social']} | "
                f"Comprobante {comprobante['numero_completo'] or '-'}"
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )


def generar_pdf_comprobante(comprobante: dict[str, Any]) -> bytes:
    return ComprobantePDF().componer(comprobante)
