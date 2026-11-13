from decimal import ROUND_HALF_UP, Decimal
from typing import TypedDict

_CENTAVOS = Decimal("0.01")
_CIEN = Decimal("100")
_MAX_IMPORTE = Decimal("999999999999.99")


class VentaImporteInvalido(Exception):
    pass


class VentaLinea(TypedDict):
    id_producto: str
    cantidad: Decimal
    descuento_producto: Decimal
    iva: Decimal
    neto: Decimal
    precio_unitario: Decimal
    subtotal: Decimal
    tipo_iva: str


def calcular_linea_venta(
    id_producto: str,
    cantidad: Decimal,
    descuento_producto: Decimal,
    descuento_compra: Decimal,
    precio_unitario: Decimal,
    porcentaje_iva: Decimal,
    tipo_iva: str,
) -> VentaLinea:
    base_sin_redondear = cantidad * precio_unitario
    if base_sin_redondear > _MAX_IMPORTE:
        raise VentaImporteInvalido("El subtotal excede el máximo permitido")

    base = base_sin_redondear.quantize(_CENTAVOS, rounding=ROUND_HALF_UP)
    neto_con_descuento_linea = (
        base * (Decimal("1") - descuento_producto / _CIEN)
    ).quantize(_CENTAVOS, rounding=ROUND_HALF_UP)
    subtotal = (
        neto_con_descuento_linea
        * (Decimal("1") - descuento_compra / _CIEN)
    ).quantize(_CENTAVOS, rounding=ROUND_HALF_UP)
    neto = (
        subtotal / (Decimal("1") + porcentaje_iva / _CIEN)
    ).quantize(_CENTAVOS, rounding=ROUND_HALF_UP)
    iva = subtotal - neto
    if max(subtotal, neto, iva) > _MAX_IMPORTE:
        raise VentaImporteInvalido("El subtotal excede el máximo permitido")

    return {
        "id_producto": id_producto,
        "cantidad": cantidad,
        "descuento_producto": descuento_producto,
        "iva": iva,
        "neto": neto,
        "precio_unitario": precio_unitario,
        "subtotal": subtotal,
        "tipo_iva": tipo_iva,
    }
