from decimal import Decimal

import pytest

from app.services.factura_compra_calculos import (
    FacturaCompraCalculoError,
    agrupar_iva_factura_compra,
    calcular_linea_factura_compra,
    calcular_tipo_comprobante_compra,
    calcular_totales_factura_compra,
)


def _linea(
    *,
    alicuota: str = "21",
    tipo_iva: str = "gravado",
    precio_incluye_iva: bool = False,
    descuento: str = "0",
) -> dict:
    return calcular_linea_factura_compra(
        id_producto="PRD-0001",
        id_alicuota_iva="AIV-0001",
        descripcion="Producto",
        cantidad=Decimal("2"),
        precio_unitario=Decimal("100.00"),
        precio_incluye_iva=precio_incluye_iva,
        descuento_producto=Decimal(descuento),
        tipo_iva=tipo_iva,
        alicuota=Decimal(alicuota),
    )


def test_linea_con_iva_discriminado() -> None:
    linea = _linea()
    assert linea["neto"] == Decimal("200.00")
    assert linea["iva"] == Decimal("42.00")
    assert linea["subtotal"] == Decimal("242.00")


def test_linea_con_iva_incluido_en_precio() -> None:
    linea = _linea(precio_incluye_iva=True)
    assert linea["neto"] == Decimal("165.29")
    assert linea["iva"] == Decimal("34.71")
    assert linea["subtotal"] == Decimal("200.00")


def test_linea_con_descuento_y_exenta() -> None:
    linea = _linea(alicuota="0", tipo_iva="exento", descuento="10")
    assert linea["descuento"] == Decimal("20.00")
    assert linea["neto"] == Decimal("180.00")
    assert linea["iva"] == Decimal("0.00")
    assert linea["subtotal"] == Decimal("180.00")


def test_totales_incluyen_tributos_y_retenciones() -> None:
    totales = calcular_totales_factura_compra(
        [_linea()],
        [
            {"tipo_tributo": "percepcion", "importe": Decimal("5.00")},
            {"tipo_tributo": "retencion", "importe": Decimal("3.00")},
        ],
    )
    assert totales["neto"] == Decimal("200.00")
    assert totales["iva"] == Decimal("42.00")
    assert totales["otros_tributos"] == Decimal("5.00")
    assert totales["retenciones"] == Decimal("3.00")
    assert totales["total"] == Decimal("244.00")


def test_totales_rechazan_total_negativo() -> None:
    with pytest.raises(FacturaCompraCalculoError):
        calcular_totales_factura_compra(
            [_linea()],
            [{"tipo_tributo": "retencion", "importe": Decimal("500.00")}],
        )


def test_agrupacion_de_iva() -> None:
    grupos = agrupar_iva_factura_compra([_linea(), _linea()])
    assert len(grupos) == 1
    assert grupos[0]["base_imponible"] == Decimal("400.00")
    assert grupos[0]["importe_iva"] == Decimal("84.00")


@pytest.mark.parametrize(
    ("proveedor", "empresa", "esperado"),
    [
        ("IVA Responsable Inscripto", "responsable_inscripto", "A"),
        ("IVA Responsable Inscripto", "monotributista", "A"),
        ("IVA Responsable Inscripto", "exento", "B"),
        ("Responsable Monotributo", "responsable_inscripto", "C"),
        ("IVA Sujeto Exento", "responsable_inscripto", "C"),
    ],
)
def test_tipo_comprobante_segun_condiciones(
    proveedor: str, empresa: str, esperado: str
) -> None:
    assert calcular_tipo_comprobante_compra(proveedor, empresa) == esperado
