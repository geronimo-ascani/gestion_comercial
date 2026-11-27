import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_factura_proveedor_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.facturas_proveedor import router
from app.services.factura_proveedor_service import (
    FacturaProveedorNoEncontrado,
    PagoFacturaDatosInvalidos,
)

_CONTENIDO_PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"

_FACTURA = {
    "id_factura_proveedor": "FP-0001",
    "numero_comprobante": "FP-0001",
    "numero_completo": "FP-0001",
    "tipo_comprobante": "A",
    "estado_pago": "emitida",
    "fecha_emision": datetime(2026, 11, 20, tzinfo=timezone.utc),
    "fecha_vence": datetime(2026, 12, 20, tzinfo=timezone.utc),
    "total": Decimal("242.00"),
    "saldo_pendiente": Decimal("242.00"),
    "id_empresa": "EMP-0001",
    "id_proveedor": "PRV-0001",
    "proveedor_razon_social": "Proveedor SA",
    "id_pedido_proveedor": "OC-0001",
    "archivo_nombre": "factura.pdf",
    "archivo_mime_type": "application/pdf",
    "archivo_tamanio": len(_CONTENIDO_PDF),
    "archivo_url": "/compras/facturas/FP-0001/archivo",
    "tiene_archivo": True,
    "creado_en": datetime(2026, 11, 20, tzinfo=timezone.utc),
    "proveedor_cuit": "20123456789",
    "proveedor_domicilio": "Av. Proveedor 100",
    "proveedor_condicion_iva": "IVA Responsable Inscripto",
    "empresa_razon_social": "Empresa receptora",
    "empresa_cuit": "20111111112",
    "empresa_domicilio": "Calle 1",
    "empresa_condicion_iva": "responsable_inscripto",
    "pagos": [],
}

_RESPONSE_FACTURA = dict(_FACTURA)

_RESUMEN = {clave: _FACTURA[clave] for clave in (
    "id_factura_proveedor", "numero_comprobante", "numero_completo",
    "tipo_comprobante", "estado_pago", "fecha_emision",
    "fecha_vence", "total", "saldo_pendiente",
    "id_empresa", "id_proveedor", "proveedor_razon_social",
    "id_pedido_proveedor", "archivo_nombre", "archivo_mime_type",
    "archivo_tamanio", "archivo_url", "tiene_archivo",
)}

_PAGO = {
    "id_pago": "PAG-0001",
    "estado": "aprobado",
    "fecha_pago": "2026-11-20",
    "monto": Decimal("100.00"),
    "referencia": "",
    "id_medio_pago": "MPG-0001",
    "medio_pago": "Efectivo",
    "creado_en": datetime(2026, 11, 20, tzinfo=timezone.utc),
    "id_comprobante_venta": None,
    "id_factura_proveedor": "FP-0001",
    "tipo_pago": "pago",
}

_CREAR = {
    "id_pedido_proveedor": "OC-0001",
    "fecha_emision": "2026-11-20T10:00:00Z",
    "fecha_vence": "2026-12-20T10:00:00Z",
    "total": "242.00",
}


_PAGO_PROVEEDOR_LISTADO = {
    "id_pago": "PAG-0001",
    "fecha_pago": "2026-11-20",
    "monto": Decimal("100.00"),
    "estado": "aprobado",
    "referencia": "Transferencia",
    "id_medio_pago": "MPG-0001",
    "medio_pago": "Efectivo",
    "id_factura_proveedor": "FP-0001",
    "numero_factura": "FP-0001",
    "id_proveedor": "PRV-0001",
    "proveedor_razon_social": "Proveedor SA",
    "creado_en": datetime(2026, 11, 20, tzinfo=timezone.utc),
}


class FakeService:
    def __init__(self) -> None:
        self.archivo_recibido = None
        self.parametros_pagos: tuple | None = None

    def crear(self, _datos, _id_empleado, archivo):
        self.archivo_recibido = archivo
        return _RESPONSE_FACTURA

    def obtener(self, id_factura):
        if id_factura == "FP-9999":
            raise FacturaProveedorNoEncontrado(id_factura)
        return _RESPONSE_FACTURA

    def obtener_archivo(self, id_factura):
        if id_factura == "FP-9999":
            raise FacturaProveedorNoEncontrado(id_factura)
        return {
            "nombre_archivo": "factura.pdf",
            "mime_type": "application/pdf",
            "tamanio": len(_CONTENIDO_PDF),
            "contenido": _CONTENIDO_PDF,
        }

    def listar(self, *_args):
        return [_RESUMEN]

    def listar_por_pedido(self, _id_pedido):
        return [_RESUMEN]

    def listar_pagos(self, id_factura):
        if id_factura == "FP-9999":
            raise FacturaProveedorNoEncontrado(id_factura)
        return [_PAGO]

    def listar_pagos_globales(self, *args):
        self.parametros_pagos = args
        return [_PAGO_PROVEEDOR_LISTADO]

    def registrar_pago(self, id_factura, _datos):
        return _PAGO

    def cambiar_estado_pago(self, id_factura, id_pago, datos):
        if id_factura == "FP-9999":
            raise FacturaProveedorNoEncontrado(id_factura)
        if id_pago == "PAG-9999":
            raise PagoFacturaDatosInvalidos("El pago ya no está pendiente")
        return {**_PAGO, "estado": datos.estado}


def _client(rol: str, service_factory=FakeService) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "id_empresa": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_factura_proveedor_service] = service_factory
    return TestClient(app)


def _multipart(**overrides):
    metadata = {**_CREAR, **overrides}
    return {
        "data": {"metadata": json.dumps(metadata)},
        "files": {
            "archivo": (
                "factura.pdf",
                _CONTENIDO_PDF,
                "application/pdf",
            )
        },
    }


def test_abastecimiento_puede_crear_factura_con_archivo() -> None:
    with _client("abastecimiento") as client:
        response = client.post("/api/v1/compras/facturas", **_multipart())
    assert response.status_code == 201
    assert response.json()["numero_completo"] == "FP-0001"
    assert response.json()["tipo_comprobante"] == "A"
    assert response.json()["tiene_archivo"] is True


def test_ventas_no_puede_crear_factura() -> None:
    with _client("ventas") as client:
        response = client.post("/api/v1/compras/facturas", **_multipart())
    assert response.status_code == 403


def test_metadata_invalida_devuelve_422() -> None:
    with _client("administrador") as client:
        response = client.post(
            "/api/v1/compras/facturas",
            data={"metadata": json.dumps({"numero_comprobante": "1"})},
            files={"archivo": ("factura.pdf", _CONTENIDO_PDF, "application/pdf")},
        )
    assert response.status_code == 422


def test_metadata_con_campos_fuera_del_listado_devuelve_422() -> None:
    with _client("administrador") as client:
        response = client.post(
            "/api/v1/compras/facturas",
            **_multipart(neto="200.00", cae="12345678901234"),
        )
    assert response.status_code == 422


def test_numero_y_punto_de_venta_no_se_aceptan() -> None:
    with _client("administrador") as client:
        response = client.post(
            "/api/v1/compras/facturas",
            **_multipart(numero_comprobante="12", punto_venta="1"),
        )
    assert response.status_code == 422


def test_descarga_devuelve_pdf_con_headers() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/compras/facturas/FP-0001/archivo")
    assert response.status_code == 200
    assert response.content == _CONTENIDO_PDF
    assert response.headers["content-type"] == "application/pdf"
    assert "inline" in response.headers["content-disposition"]


def test_descarga_de_factura_inexistente_devuelve_404() -> None:
    with _client("abastecimiento") as client:
        response = client.get("/api/v1/compras/facturas/FP-9999/archivo")
    assert response.status_code == 404


def test_listado_y_detalle_devuelven_snapshot() -> None:
    with _client("administrador") as client:
        listado = client.get("/api/v1/compras/facturas")
        detalle = client.get("/api/v1/compras/facturas/FP-0001")
    assert listado.status_code == 200
    assert listado.json()[0]["proveedor_razon_social"] == "Proveedor SA"
    assert listado.json()[0]["archivo_url"].endswith("/archivo")
    assert detalle.status_code == 200
    assert detalle.json()["empresa_cuit"] == "20111111112"


def test_listado_global_de_pagos_a_proveedores() -> None:
    service = FakeService()
    with _client("administrador", lambda: service) as client:
        response = client.get(
            "/api/v1/compras/pagos"
            "?desde=2026-11-01&hasta=2026-11-30"
            "&id_proveedor=PRV-0001&estado=aprobado"
            "&id_medio_pago=MPG-0001&limit=25&offset=5"
        )

    assert response.status_code == 200
    assert response.json()[0]["numero_factura"] == "FP-0001"
    assert response.json()[0]["proveedor_razon_social"] == "Proveedor SA"
    assert service.parametros_pagos == (
        date(2026, 11, 1),
        date(2026, 11, 30),
        "PRV-0001",
        "aprobado",
        "MPG-0001",
        25,
        5,
    )


def test_listado_global_de_pagos_es_admin_only() -> None:
    for rol in ("ventas", "abastecimiento"):
        with _client(rol) as client:
            response = client.get("/api/v1/compras/pagos")
        assert response.status_code == 403


def test_facturas_por_pedido() -> None:
    with _client("abastecimiento") as client:
        response = client.get("/api/v1/compras/pedidos/OC-0001/facturas")
    assert response.status_code == 200
    assert response.json()[0]["id_pedido_proveedor"] == "OC-0001"


def test_pagos_de_factura() -> None:
    with _client("administrador") as client:
        listado = client.get("/api/v1/compras/facturas/FP-0001/pagos")
        creado = client.post(
            "/api/v1/compras/facturas/FP-0001/pagos",
            json={"id_medio_pago": "MPG-0001", "monto": 100},
        )
    assert listado.status_code == 200
    assert listado.json()[0]["tipo_pago"] == "pago"
    assert creado.status_code == 201


def test_pago_de_factura_rechaza_fecha_futura() -> None:
    futuro = (date.today() + timedelta(days=1)).isoformat()
    with _client("administrador") as client:
        response = client.post(
            "/api/v1/compras/facturas/FP-0001/pagos",
            json={
                "id_medio_pago": "MPG-0001",
                "monto": 100,
                "fecha_pago": futuro,
            },
        )
    assert response.status_code == 422


def test_cambiar_estado_pago_pendiente_de_factura() -> None:
    with _client("abastecimiento") as client:
        aprobado = client.patch(
            "/api/v1/compras/facturas/FP-0001/pagos/PAG-0001",
            json={"estado": "aprobado"},
        )
        rechazado = client.patch(
            "/api/v1/compras/facturas/FP-0001/pagos/PAG-0001",
            json={"estado": "rechazado"},
        )
    assert aprobado.status_code == 200
    assert aprobado.json()["estado"] == "aprobado"
    assert rechazado.status_code == 200
    assert rechazado.json()["estado"] == "rechazado"


def test_cambiar_estado_pago_rechaza_estado_no_permitido() -> None:
    with _client("administrador") as client:
        response = client.patch(
            "/api/v1/compras/facturas/FP-0001/pagos/PAG-0001",
            json={"estado": "pendiente"},
        )
    assert response.status_code == 422


def test_cambiar_estado_pago_invalido_devuelve_409() -> None:
    with _client("administrador") as client:
        response = client.patch(
            "/api/v1/compras/facturas/FP-0001/pagos/PAG-9999",
            json={"estado": "aprobado"},
        )
    assert response.status_code == 409


def test_cambiar_estado_pago_requiere_permiso() -> None:
    with _client("ventas") as client:
        response = client.patch(
            "/api/v1/compras/facturas/FP-0001/pagos/PAG-0001",
            json={"estado": "aprobado"},
        )
    assert response.status_code == 403


def test_factura_inexistente_devuelve_404() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/compras/facturas/FP-9999")
    assert response.status_code == 404
