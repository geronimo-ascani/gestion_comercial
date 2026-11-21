"""Cálculos puros heredados y derivación del tipo de comprobante de compra.

Toda operación monetaria usa ``Decimal`` y redondeo ``ROUND_HALF_UP``.
El alta actual solo transcribe los metadatos del listado desde el PDF/JPG;
el resto de los importes permanece dentro del archivo del proveedor.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import TypedDict

_CENTAVOS = Decimal("0.01")
_MILISIMOS = Decimal("0.001")
_CIEN = Decimal("100")
_UNO = Decimal("1")
_MAX_IMPORTE = Decimal("999999999999.99")


class FacturaCompraCalculoError(Exception):
    pass


class LineaFacturaCompraCalculada(TypedDict):
    id_producto: str
    id_alicuota_iva: str
    descripcion: str
    cantidad: Decimal
    precio_unitario: Decimal
    precio_incluye_iva: bool
    descuento_producto: Decimal
    descuento: Decimal
    tipo_iva: str
    alicuota: Decimal
    neto: Decimal
    iva: Decimal
    subtotal: Decimal
    impuestos_internos: Decimal


class TotalesFacturaCompra(TypedDict):
    neto: Decimal
    iva: Decimal
    otros_tributos: Decimal
    retenciones: Decimal
    descuento: Decimal
    total: Decimal


class GrupoIVAFacturaCompra(TypedDict):
    id_alicuota_iva: str
    tipo_iva: str
    alicuota: Decimal
    base_imponible: Decimal
    importe_iva: Decimal


def _money(valor: Decimal) -> Decimal:
    return valor.quantize(_CENTAVOS, rounding=ROUND_HALF_UP)


def _validar_importe(valor: Decimal, nombre: str) -> None:
    if valor < 0 or valor > _MAX_IMPORTE:
        raise FacturaCompraCalculoError(f"El {nombre} no es válido")


def calcular_linea_factura_compra(
    *,
    id_producto: str,
    id_alicuota_iva: str,
    descripcion: str,
    cantidad: Decimal,
    precio_unitario: Decimal,
    precio_incluye_iva: bool,
    descuento_producto: Decimal,
    tipo_iva: str,
    alicuota: Decimal,
) -> LineaFacturaCompraCalculada:
    """Calcula una línea con IVA discriminado o contenido en el precio."""
    cantidad = cantidad.quantize(_MILISIMOS, rounding=ROUND_HALF_UP)
    precio_unitario = _money(precio_unitario)
    descuento_producto = descuento_producto.quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    alicuota = alicuota.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if cantidad <= 0:
        raise FacturaCompraCalculoError("La cantidad debe ser mayor que cero")
    if precio_unitario < 0:
        raise FacturaCompraCalculoError("El precio unitario no puede ser negativo")
    if descuento_producto < 0 or descuento_producto > 100:
        raise FacturaCompraCalculoError(
            "El descuento por línea debe estar entre 0 y 100"
        )
    if alicuota < 0 or alicuota > 100:
        raise FacturaCompraCalculoError("La alícuota de IVA no es válida")

    base = _money(cantidad * precio_unitario)
    _validar_importe(base, "subtotal de la línea")
    base_con_descuento = _money(
        base * (_UNO - descuento_producto / _CIEN)
    )
    descuento = base - base_con_descuento

    neto = base_con_descuento
    iva = Decimal("0")
    if tipo_iva == "gravado" and alicuota > 0:
        if precio_incluye_iva:
            neto = _money(base_con_descuento / (_UNO + alicuota / _CIEN))
            iva = base_con_descuento - neto
        else:
            iva = _money(neto * alicuota / _CIEN)

    subtotal = (
        base_con_descuento if precio_incluye_iva else _money(neto + iva)
    )
    _validar_importe(subtotal, "subtotal de la línea")

    return {
        "id_producto": id_producto,
        "id_alicuota_iva": id_alicuota_iva,
        "descripcion": descripcion,
        "cantidad": cantidad,
        "precio_unitario": precio_unitario,
        "precio_incluye_iva": precio_incluye_iva,
        "descuento_producto": descuento_producto,
        "descuento": descuento,
        "tipo_iva": tipo_iva,
        "alicuota": alicuota,
        "neto": neto,
        "iva": iva,
        "subtotal": subtotal,
        "impuestos_internos": Decimal("0"),
    }


def calcular_totales_factura_compra(
    lineas: list[LineaFacturaCompraCalculada],
    tributos: list[dict[str, object]] | None = None,
) -> TotalesFacturaCompra:
    if not lineas:
        raise FacturaCompraCalculoError("La factura debe tener al menos un renglón")

    neto = sum((linea["neto"] for linea in lineas), Decimal("0"))
    iva = sum((linea["iva"] for linea in lineas), Decimal("0"))
    descuento = sum((linea["descuento"] for linea in lineas), Decimal("0"))
    subtotal = sum((linea["subtotal"] for linea in lineas), Decimal("0"))

    otros_tributos = Decimal("0")
    retenciones = Decimal("0")
    for tributo in tributos or []:
        importe = Decimal(str(tributo["importe"]))
        if importe < 0:
            raise FacturaCompraCalculoError(
                "El importe del tributo no puede ser negativo"
            )
        if tributo["tipo_tributo"] == "retencion":
            retenciones += importe
        else:
            otros_tributos += importe

    total = subtotal + otros_tributos - retenciones
    for nombre, valor in (
        ("neto", neto),
        ("IVA", iva),
        ("total", total),
    ):
        _validar_importe(valor, nombre)

    return {
        "neto": _money(neto),
        "iva": _money(iva),
        "otros_tributos": _money(otros_tributos),
        "retenciones": _money(retenciones),
        "descuento": _money(descuento),
        "total": _money(total),
    }


def agrupar_iva_factura_compra(
    lineas: list[LineaFacturaCompraCalculada],
) -> list[GrupoIVAFacturaCompra]:
    agrupados: dict[tuple[str, str], GrupoIVAFacturaCompra] = {}
    for linea in lineas:
        clave = (linea["id_alicuota_iva"], linea["tipo_iva"])
        grupo = agrupados.get(clave)
        if grupo is None:
            grupo = {
                "id_alicuota_iva": linea["id_alicuota_iva"],
                "tipo_iva": linea["tipo_iva"],
                "alicuota": linea["alicuota"],
                "base_imponible": Decimal("0"),
                "importe_iva": Decimal("0"),
            }
            agrupados[clave] = grupo
        grupo["base_imponible"] += linea["neto"]
        grupo["importe_iva"] += linea["iva"]
    for grupo in agrupados.values():
        grupo["base_imponible"] = _money(grupo["base_imponible"])
        grupo["importe_iva"] = _money(grupo["importe_iva"])
    return list(agrupados.values())


def normalizar_condicion_iva(valor: str) -> str:
    texto = (valor or "").strip().lower()
    if "responsable inscripto" in texto or texto in {"1", "responsable_inscripto"}:
        return "responsable_inscripto"
    if "monotribut" in texto or texto in {"6", "monotributista"}:
        return "monotributista"
    if "exento" in texto or texto in {"4", "exento"}:
        return "exento"
    return "consumidor_final"


def calcular_tipo_comprobante_compra(
    condicion_proveedor: str,
    condicion_empresa: str,
) -> str:
    """Clase de comprobante recibido según ambas condiciones frente a IVA.

    Un proveedor que no es responsable inscripto emite C. Un responsable
    inscripto emite A cuando la empresa receptora también es responsable
    inscripto o monotributista, y B en el resto de los casos.
    """
    emisor = normalizar_condicion_iva(condicion_proveedor)
    receptor = normalizar_condicion_iva(condicion_empresa)
    if emisor != "responsable_inscripto":
        return "C"
    if receptor in ("responsable_inscripto", "monotributista"):
        return "A"
    return "B"
