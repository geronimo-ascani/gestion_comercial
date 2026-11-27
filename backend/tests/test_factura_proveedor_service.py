from contextlib import nullcontext
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.facturas_proveedor import (
    FacturaProveedorCreate,
    PagoProveedorCreate,
)
from app.schemas.pagos import PagoEstadoUpdate
from app.services.factura_proveedor_service import (
    MAX_ARCHIVO_BYTES,
    FacturaProveedorDatosInvalidos,
    FacturaProveedorNoEncontrado,
    FacturaProveedorService,
    PagoFacturaDatosInvalidos,
)

_EMPRESA = {
    "id_empresa": "EMP-0001",
    "razon_social": "Empresa receptora",
    "cuit": "20111111112",
    "condicion_iva": "responsable_inscripto",
    "domicilio": "Calle 1",
}

_PEDIDO = {
    "id_pedido_proveedor": "OC-0001",
    "id_proveedor": "PRV-0001",
    "estado": "cancelada",
    "total": Decimal("242.00"),
    "proveedor_razon_social": "Proveedor SA",
    "proveedor_cuit": "20123456789",
    "proveedor_condicion_iva_descripcion": "IVA Responsable Inscripto",
    "proveedor_condicion_iva_codigo": "1",
    "proveedor_domicilio": "Av. Proveedor 100",
}

_PAGO = {
    "id_pago": "PAG-0001",
    "estado": "aprobado",
    "fecha_pago": date(2026, 11, 20),
    "monto": Decimal("100.00"),
    "referencia": "Transferencia",
    "id_medio_pago": "MPG-0001",
    "medio_pago": "Transferencia",
    "creado_en": datetime(2026, 11, 20, tzinfo=timezone.utc),
    "id_comprobante_venta": None,
    "id_factura_proveedor": "FP-0001",
    "tipo_pago": "pago",
}

_CONTENIDO_PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"


def _datos(**overrides) -> FacturaProveedorCreate:
    valores = {
        "id_pedido_proveedor": "OC-0001",
        "fecha_emision": datetime(2026, 11, 20, tzinfo=timezone.utc),
        "fecha_vence": datetime(2026, 12, 20, tzinfo=timezone.utc),
        "total": Decimal("242.00"),
    }
    valores.update(overrides)
    return FacturaProveedorCreate.model_validate(valores)


def _archivo(**overrides) -> dict:
    valores = {
        "nombre": "factura proveedor.pdf",
        "mime_type": "application/pdf",
        "contenido": _CONTENIDO_PDF,
    }
    valores.update(overrides)
    return valores


def _factura_row(**overrides) -> dict:
    fila = {
        "id_factura_proveedor": "FP-0001",
        "numero_comprobante": "FP-0001",
        "numero_completo": "FP-0001",
        "tipo_comprobante": "A",
        "estado_pago": "emitida",
        "fecha_emision": datetime(2026, 11, 20, tzinfo=timezone.utc),
        "fecha_vence": datetime(2026, 12, 20, tzinfo=timezone.utc),
        "total": Decimal("242.00"),
        "saldo_pendiente": Decimal("242.00"),
        "creado_en": datetime(2026, 11, 20, tzinfo=timezone.utc),
        "id_empresa": "EMP-0001",
        "id_proveedor": "PRV-0001",
        "proveedor_razon_social": "Proveedor SA",
        "proveedor_cuit": "20123456789",
        "proveedor_domicilio": "Av. Proveedor 100",
        "proveedor_condicion_iva": "IVA Responsable Inscripto",
        "empresa_razon_social": "Empresa receptora",
        "empresa_cuit": "20111111112",
        "empresa_domicilio": "Calle 1",
        "empresa_condicion_iva": "responsable_inscripto",
        "id_pedido_proveedor": "OC-0001",
        "id_empleado": "EMP-0002",
        "archivo_nombre": "factura proveedor.pdf",
        "archivo_mime_type": "application/pdf",
        "archivo_tamanio": len(_CONTENIDO_PDF),
        "archivo_url": "/compras/facturas/FP-0001/archivo",
        "pagos": [],
    }
    fila.update(overrides)
    return fila


class FakeFacturaRepository:
    def __init__(self, *, pedido_inexistente: bool = False) -> None:
        self.pedido = dict(_PEDIDO)
        self.factura: dict | None = None
        self.pedido_inexistente = pedido_inexistente
        self.creado: dict | None = None
        self.archivo_guardado: dict | None = None
        self.pago_actualizado: tuple[str, object] | None = None

    def transaction(self):
        return nullcontext()

    def obtener_pedido(self, _id_pedido, bloquear=False):
        return None if self.pedido_inexistente else dict(self.pedido)

    def crear(self, factura, archivo):
        self.creado = factura
        self.archivo_guardado = archivo
        self.factura = _factura_row(
            **{
                clave: valor
                for clave, valor in factura.items()
                if clave in _factura_row()
            }
        )
        self.factura["archivo_nombre"] = archivo["nombre"]
        self.factura["archivo_mime_type"] = archivo["mime_type"]
        self.factura["archivo_tamanio"] = archivo["tamanio"]
        return self.factura["id_factura_proveedor"]

    def obtener(self, id_factura, bloquear=False):
        if self.factura is None or id_factura != self.factura["id_factura_proveedor"]:
            return None
        return dict(self.factura)

    def archivo(self, id_factura):
        if self.factura is None or id_factura != self.factura["id_factura_proveedor"]:
            return None
        return {
            "nombre_archivo": self.factura["archivo_nombre"],
            "mime_type": self.factura["archivo_mime_type"],
            "tamanio": self.factura["archivo_tamanio"],
            "contenido": self.archivo_guardado["contenido"],
        }

    def existe(self, id_factura):
        return self.factura is not None and id_factura == self.factura["id_factura_proveedor"]

    def listar(self, *_args):
        return [self._resumen()] if self.factura else []

    def listar_por_pedido(self, _id_pedido):
        return [self._resumen()] if self.factura else []

    def _resumen(self):
        return {clave: self.factura[clave] for clave in (
            "id_factura_proveedor", "numero_comprobante", "numero_completo",
            "tipo_comprobante", "estado_pago", "fecha_emision",
            "fecha_vence", "total", "saldo_pendiente",
            "id_empresa", "id_proveedor", "proveedor_razon_social",
            "id_pedido_proveedor", "archivo_nombre", "archivo_mime_type",
            "archivo_tamanio", "archivo_url",
        )}

    def actualizar_pago(self, _id_factura, estado, saldo):
        self.pago_actualizado = (estado, saldo)
        self.factura["estado_pago"] = estado
        self.factura["saldo_pendiente"] = saldo


class FakePagoRepository:
    def __init__(self) -> None:
        self.pagos: list[dict] = []
        self.medio_valido = True

    def medio_pago_existe(self, _id_medio_pago):
        return self.medio_valido

    def sumar_factura(self, _id_factura, estados):
        return sum(
            (pago["monto"] for pago in self.pagos if pago["estado"] in estados),
            Decimal("0"),
        )

    def crear(self, datos):
        pago = {
            **_PAGO,
            **datos,
            "id_pago": f"PAG-{len(self.pagos) + 1:04d}",
        }
        self.pagos.append(pago)
        return pago["id_pago"]

    def obtener(self, id_pago):
        return next((dict(pago) for pago in self.pagos if pago["id_pago"] == id_pago), None)

    def listar_por_factura(self, _id_factura):
        return [dict(pago) for pago in self.pagos]

    def actualizar_estado(self, id_pago, estado, id_factura):
        pago = next(
            (p for p in self.pagos if p["id_pago"] == id_pago), None
        )
        if (
            pago is None
            or pago["estado"] != "pendiente"
            or pago["id_factura_proveedor"] != id_factura
        ):
            return False
        pago["estado"] = estado
        return True


class FakeEmpresas:
    def obtener(self, _id_empresa):
        return dict(_EMPRESA)


def _servicio(**kwargs) -> FacturaProveedorService:
    repo = FakeFacturaRepository(**kwargs)
    return FacturaProveedorService(
        repo,
        FakePagoRepository(),
        FakeEmpresas(),
        id_empresa="EMP-0001",
    )


def test_crear_deriva_empresa_proveedor_y_guarda_metadatos() -> None:
    servicio = _servicio()
    factura = servicio.crear(_datos(), "EMP-0002", _archivo())
    assert factura["tipo_comprobante"] == "A"
    assert factura["id_proveedor"] == "PRV-0001"
    assert factura["id_empleado"] == "EMP-0002"
    assert factura["total"] == Decimal("242.00")
    assert factura["saldo_pendiente"] == Decimal("242.00")
    assert factura["numero_completo"] == "FP-0001"
    assert factura["tiene_archivo"] is True
    assert factura["archivo_nombre"] == "factura proveedor.pdf"


def test_id_no_se_envia_en_la_creacion() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    assert "id_factura_proveedor" not in servicio._repo.creado


def test_solo_se_persisten_metadatos_del_listado() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    guardado = servicio._repo.creado or {}
    for campo in (
        "neto", "iva", "otros_tributos", "retenciones", "descuento",
        "moneda", "cotizacion", "cae", "cae_vence", "codigo_autorizacion",
        "tipo_codigo_autorizacion", "qr", "observaciones",
        "punto_venta", "numero_comprobante",
    ):
        assert campo not in guardado
    assert guardado["total"] == Decimal("242.00")


def test_metadatos_fuera_del_listado_se_rechazan() -> None:
    for campo, valor in (
        ("neto", Decimal("200.00")),
        ("punto_venta", "1"),
        ("numero_comprobante", "12"),
    ):
        with pytest.raises(ValidationError):
            FacturaProveedorCreate.model_validate(
                {**_datos().model_dump(), campo: valor}
            )


def test_listar_no_requiere_campos_legacy() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())

    resumenes = servicio.listar(None, None, None, None, 50, 0)

    assert len(resumenes) == 1
    assert resumenes[0]["total"] == Decimal("242.00")
    assert "neto" not in resumenes[0]
    assert "iva" not in resumenes[0]


def test_orden_cancelada_no_bloquea_la_factura_recibida() -> None:
    servicio = _servicio()
    factura = servicio.crear(_datos(), "EMP-0002", _archivo())
    assert factura["id_factura_proveedor"] == "FP-0001"


def test_numero_visible_es_el_id_generado() -> None:
    servicio = _servicio()
    factura = servicio.crear(_datos(), "EMP-0002", _archivo())
    assert factura["numero_comprobante"] == factura["id_factura_proveedor"]
    assert factura["numero_completo"] == factura["id_factura_proveedor"]


def test_pedido_inexistente_no_encontrado() -> None:
    with pytest.raises(FacturaProveedorNoEncontrado):
        _servicio(pedido_inexistente=True).crear(
            _datos(), "EMP-0002", _archivo()
        )


@pytest.mark.parametrize(
    "archivo",
    [
        {"nombre": "factura.txt", "mime_type": "text/plain"},
        {"nombre": "factura.pdf", "mime_type": "image/jpeg"},
        {"nombre": "factura.pdf", "contenido": b"no es pdf"},
        {"nombre": "factura.jpg", "mime_type": "image/jpeg", "contenido": b"no es jpg"},
        {"nombre": "factura.pdf", "contenido": b""},
    ],
)
def test_archivo_invalido_se_rechaza(archivo: dict) -> None:
    with pytest.raises(FacturaProveedorDatosInvalidos):
        _servicio().crear(_datos(), "EMP-0002", _archivo(**archivo))


def test_archivo_mayor_a_tres_mb_se_rechaza() -> None:
    contenido = b"%PDF-" + b"0" * MAX_ARCHIVO_BYTES
    with pytest.raises(FacturaProveedorDatosInvalidos):
        _servicio().crear(
            _datos(), "EMP-0002", _archivo(contenido=contenido)
        )


def test_jpg_valido_se_acepta() -> None:
    contenido = b"\xff\xd8\xff\xe0" + b"jpg" * 10
    servicio = _servicio()
    factura = servicio.crear(
        _datos(),
        "EMP-0002",
        _archivo(
            nombre="factura.jpg",
            mime_type="image/jpeg",
            contenido=contenido,
        ),
    )
    assert factura["archivo_mime_type"] == "image/jpeg"
    assert factura["archivo_tamanio"] == len(contenido)


def test_archivo_se_devuelve_para_descarga() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    archivo = servicio.obtener_archivo("FP-0001")
    assert archivo["nombre_archivo"] == "factura proveedor.pdf"
    assert archivo["contenido"] == _CONTENIDO_PDF


def test_pago_aprobado_actualiza_saldo_y_estado() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    pago = servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {"id_medio_pago": "MPG-0001", "monto": Decimal("100.00")}
        ),
    )
    assert pago["tipo_pago"] == "pago"
    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("142.00")
    assert factura["estado_pago"] == "emitida"


def test_pago_total_deja_factura_pagada() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {"id_medio_pago": "MPG-0001", "monto": Decimal("242.00")}
        ),
    )
    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("0.00")
    assert factura["estado_pago"] == "pagada"


def test_pago_pendiente_no_afecta_saldo() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {
                "id_medio_pago": "MPG-0001",
                "monto": Decimal("100.00"),
                "estado": "pendiente",
            }
        ),
    )
    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("242.00")
    assert factura["estado_pago"] == "emitida"


def _pago_pendiente(servicio, monto=Decimal("100.00")) -> str:
    pago = servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {
                "id_medio_pago": "MPG-0001",
                "monto": monto,
                "estado": "pendiente",
            }
        ),
    )
    return pago["id_pago"]


def test_pago_pendiente_aprobado_descuenta_saldo() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    id_pago = _pago_pendiente(servicio)

    actualizado = servicio.cambiar_estado_pago(
        "FP-0001", id_pago, PagoEstadoUpdate.model_validate({"estado": "aprobado"})
    )

    assert actualizado["estado"] == "aprobado"
    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("142.00")
    assert factura["estado_pago"] == "emitida"


def test_pago_pendiente_aprobado_puede_dejar_factura_pagada() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    id_pago = _pago_pendiente(servicio, Decimal("242.00"))

    servicio.cambiar_estado_pago(
        "FP-0001", id_pago, PagoEstadoUpdate.model_validate({"estado": "aprobado"})
    )

    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("0.00")
    assert factura["estado_pago"] == "pagada"


def test_pago_pendiente_rechazado_libera_cupo_sin_tocar_saldo() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    id_pago = _pago_pendiente(servicio, Decimal("242.00"))

    actualizado = servicio.cambiar_estado_pago(
        "FP-0001", id_pago, PagoEstadoUpdate.model_validate({"estado": "rechazado"})
    )

    assert actualizado["estado"] == "rechazado"
    factura = servicio.obtener("FP-0001")
    assert factura["saldo_pendiente"] == Decimal("242.00")
    assert factura["estado_pago"] == "emitida"
    # El cupo liberado permite registrar otro pago por el total.
    servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {"id_medio_pago": "MPG-0001", "monto": Decimal("242.00")}
        ),
    )


def test_aprobacion_se_rechaza_si_otro_pago_consumio_el_cupo() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    id_pago = _pago_pendiente(servicio)
    # Pago aprobado concurrente/legacy que ya consumió el total.
    servicio._pagos.pagos.append(
        {
            **_PAGO,
            "id_pago": "PAG-9999",
            "estado": "aprobado",
            "monto": Decimal("242.00"),
        }
    )
    with pytest.raises(PagoFacturaDatosInvalidos):
        servicio.cambiar_estado_pago(
            "FP-0001",
            id_pago,
            PagoEstadoUpdate.model_validate({"estado": "aprobado"}),
        )


def test_cambiar_estado_pago_ya_aprobado_se_rechaza() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    pago = servicio.registrar_pago(
        "FP-0001",
        PagoProveedorCreate.model_validate(
            {"id_medio_pago": "MPG-0001", "monto": Decimal("100.00")}
        ),
    )
    with pytest.raises(PagoFacturaDatosInvalidos):
        servicio.cambiar_estado_pago(
            "FP-0001",
            pago["id_pago"],
            PagoEstadoUpdate.model_validate({"estado": "rechazado"}),
        )


def test_cambiar_estado_pago_ajeno_a_la_factura_se_rechaza() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    id_pago = _pago_pendiente(servicio)
    # Simular un pago perteneciente a otra factura.
    servicio._pagos.pagos[0]["id_factura_proveedor"] = "FP-9999"
    with pytest.raises(FacturaProveedorNoEncontrado):
        servicio.cambiar_estado_pago(
            "FP-0001",
            id_pago,
            PagoEstadoUpdate.model_validate({"estado": "aprobado"}),
        )


def test_sobrepago_se_rechaza() -> None:
    servicio = _servicio()
    servicio.crear(_datos(), "EMP-0002", _archivo())
    with pytest.raises(PagoFacturaDatosInvalidos):
        servicio.registrar_pago(
            "FP-0001",
            PagoProveedorCreate.model_validate(
                {"id_medio_pago": "MPG-0001", "monto": Decimal("243.00")}
            ),
        )
