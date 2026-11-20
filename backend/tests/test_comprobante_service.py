from contextlib import nullcontext
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.schemas.comprobantes import (
    ComprobanteVentaCreate,
    ComprobanteVentaRead,
    ComprobanteVentaResumen,
)
from app.schemas.pagos import PagoCreate
from app.services.comprobante_service import (
    ComprobanteEnvioFallido,
    ComprobanteEnvioNoConfigurado,
    ComprobanteEnvioSinDestinatario,
    ComprobanteEstadoInvalido,
    ComprobanteService,
    calcular_tipo_comprobante,
)
from app.services.email_service import EmailNoConfigurado, ErrorEnvioEmail
from app.services.pago_service import PagoDatosInvalidos, PagoService


def _empresa(condicion_iva: str = "responsable_inscripto") -> dict:
    return {
        "id_empresa": "EMP-0001",
        "razon_social": "Empresa de prueba",
        "nombre_fantasia": "",
        "cuit": "20111111112",
        "condicion_iva": condicion_iva,
        "domicilio": "Av. Siempre Viva 123",
        "punto_venta": "0001",
        "email": "empresa@example.com",
        "telefono": "123456",
        "activa": True,
        "ingresos_brutos": "",
        "inicio_actividades": None,
        "codigo_postal": "",
        "localidad": "",
        "provincia": "",
    }


def _pedido(estado: str = "enviado", codigo_iva: str = "5") -> dict:
    return {
        "id_pedido_cliente": "PV-0001",
        "estado_envio": estado,
        "total": Decimal("100.00"),
        "descuento_compra": Decimal("0"),
        "entrega_calle": "Test",
        "entrega_altura": "1",
        "entrega_cp": "",
        "entrega_depto": "",
        "entrega_localidad": "CABA",
        "entrega_provincia": "Buenos Aires",
        "id_cliente": "CLI-0001",
        "cliente_nombre": "Cliente",
        "cliente_apellido": "Prueba",
        "cliente_dni_cuit": "20111111112",
        "cliente_email": "cliente@example.com",
        "cliente_telefono": "123456",
        "condicion_iva_codigo": codigo_iva,
        "condicion_iva_descripcion": "Consumidor Final",
        "items": [
            {
                "id_producto": "PRD-0001",
                "producto_nombre": "Producto",
                "cantidad": Decimal("1"),
                "descuento_producto": Decimal("0"),
                "iva": Decimal("17.36"),
                "neto": Decimal("82.64"),
                "precio_unitario": Decimal("100.00"),
                "subtotal": Decimal("100.00"),
                "tipo_iva": "gravado",
            }
        ],
    }


def _comprobante_row(**overrides) -> dict:
    row = {
        "id_comprobante_venta": "FV-0001",
        "numero_comprobante": "00000001",
        "punto_venta": "0001",
        "tipo_comprobante": "B",
        "estado_pago": "emitida",
        "fecha_emision": date(2026, 11, 18),
        "fecha_pago": None,
        "monto": Decimal("100.00"),
        "saldo_pendiente": Decimal("100.00"),
        "id_pedido_cliente": "PV-0001",
        "id_empresa": "EMP-0001",
        "id_empleado": "EMP-0001",
        "observaciones": "",
        "cae": None,
        "cae_vence": None,
        "creado_en": datetime(2026, 11, 18, tzinfo=timezone.utc),
        "empresa_razon_social": "Empresa de prueba",
        "empresa_nombre_fantasia": "",
        "empresa_cuit": "20111111112",
        "empresa_condicion_iva": "responsable_inscripto",
        "empresa_domicilio": "Av. Siempre Viva 123",
        "empresa_punto_venta": "0001",
        "empresa_email": "empresa@example.com",
        "empresa_telefono": "123456",
        "empresa_activa": True,
        "empresa_ingresos_brutos": "",
        "empresa_inicio_actividades": None,
        "empresa_codigo_postal": "",
        "empresa_localidad": "",
        "empresa_provincia": "",
        "estado_envio": "enviado",
        "descuento_compra": Decimal("0"),
        "entrega_calle": "Test",
        "entrega_altura": "1",
        "entrega_cp": "",
        "entrega_depto": "",
        "entrega_localidad": "CABA",
        "entrega_provincia": "Buenos Aires",
        "id_cliente": "CLI-0001",
        "cliente_nombre": "Cliente",
        "cliente_apellido": "Prueba",
        "cliente_dni_cuit": "20111111112",
        "cliente_email": "cliente@example.com",
        "cliente_telefono": "123456",
        "cliente_condicion_codigo": "5",
        "cliente_condicion_descripcion": "Consumidor Final",
        "enviado": False,
        "items": [
            {
                "id_producto": "PRD-0001",
                "producto_nombre": "Producto",
                "cantidad": Decimal("1"),
                "descuento_producto": Decimal("0"),
                "iva": Decimal("17.36"),
                "neto": Decimal("82.64"),
                "precio_unitario": Decimal("100.00"),
                "subtotal": Decimal("100.00"),
                "tipo_iva": "gravado",
            }
        ],
    }
    row.update(overrides)
    return row


class FakeComprobanteRepository:
    def __init__(self) -> None:
        self.pedido = _pedido()
        self.comprobante = None
        self.numeros: dict[tuple[str, str, str], int] = {}
        self.pedido_saldo = Decimal("100.00")

    def transaction(self):
        return nullcontext()

    def obtener_pedido(self, _id_pedido, bloquear=False):
        return dict(self.pedido) if self.pedido else None

    def buscar_por_pedido(self, _id_pedido, bloquear=False):
        return dict(self.comprobante) if self.comprobante else None

    def obtener(self, _id_comprobante, bloquear=False):
        return dict(self.comprobante) if self.comprobante else None

    def listar(self, _estado, _q, _limit, _offset):
        return [dict(self.comprobante)] if self.comprobante else []

    def existe(self, id_comprobante):
        return (
            self.comprobante is not None
            and self.comprobante["id_comprobante_venta"] == id_comprobante
        )

    def siguiente_numero(self, id_empresa, punto_venta, tipo):
        clave = (id_empresa, punto_venta, tipo)
        self.numeros[clave] = self.numeros.get(clave, 0) + 1
        return str(self.numeros[clave]).zfill(8)

    def crear(self, datos):
        self.items_guardados = [
            dict(item) for item in self.obtener_items_pedido(datos["id_pedido_cliente"])
        ]
        self.comprobante = _comprobante_row(
            **datos,
            id_comprobante_venta=f"FV-{len(self.numeros):04d}",
            items=[dict(item) for item in self.items_guardados],
        )
        return self.comprobante["id_comprobante_venta"]

    def crear_items(self, _id_comprobante, items):
        self.items_guardados = [dict(item) for item in items]

    def obtener_items_pedido(self, _id_pedido):
        return [dict(item) for item in self.pedido["items"]]

    def actualizar_pago(self, _id, estado, saldo, fecha_pago):
        assert self.comprobante is not None
        self.comprobante["estado_pago"] = estado
        self.comprobante["saldo_pendiente"] = saldo
        self.comprobante["fecha_pago"] = fecha_pago

    def actualizar_saldo_pedido(self, _id_pedido, saldo):
        self.pedido_saldo = saldo

    def registrar_envio(
        self, id_comprobante, destinatario, estado, error, cc=None, bcc=None
    ):
        self.envios = getattr(self, "envios", [])
        id_envio = len(self.envios) + 1
        self.envios.append(
            {
                "id_envio": id_envio,
                "destinatario": destinatario,
                "cc": list(cc or []),
                "bcc": list(bcc or []),
                "estado": estado,
                "error": error,
                "enviado_en": datetime.now(timezone.utc),
            }
        )
        return id_envio

    def obtener_envio(self, id_envio):
        for envio in getattr(self, "envios", []):
            if envio["id_envio"] == id_envio:
                return dict(envio)
        return None

    def listar_envios(self, _id_comprobante):
        return [dict(envio) for envio in getattr(self, "envios", [])]


class FakePagoRepository:
    def __init__(self) -> None:
        self.pagos: list[dict] = []
        self.medios = {"MPG-0001"}

    def listar_por_comprobante(self, id_comprobante):
        return [
            dict(pago)
            for pago in self.pagos
            if pago["id_comprobante_venta"] == id_comprobante
        ]

    def crear(self, datos):
        id_pago = f"PAG-{len(self.pagos) + 1:04d}"
        self.pagos.append(
            {
                **datos,
                "id_pago": id_pago,
                "medio_pago": "Efectivo",
                "creado_en": datetime.now(timezone.utc),
            }
        )
        return id_pago

    def obtener(self, id_pago):
        for pago in self.pagos:
            if pago["id_pago"] == id_pago:
                return dict(pago)
        return None

    def sumar(self, id_comprobante, estados):
        return sum(
            (
                pago["monto"]
                for pago in self.pagos
                if pago["id_comprobante_venta"] == id_comprobante
                and pago["estado"] in estados
            ),
            Decimal("0"),
        )

    def medio_pago_existe(self, id_medio_pago):
        return id_medio_pago in self.medios


class FakeEmpresaService:
    def __init__(self, condicion_iva="responsable_inscripto") -> None:
        self.empresa = _empresa(condicion_iva)

    def obtener_emisora(self, _id_empresa=None):
        return dict(self.empresa)


class FakeEmailService:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.enviados: list[dict] = []

    def enviar(self, **kwargs):
        if self.error is not None:
            raise self.error
        self.enviados.append(kwargs)


def _services(condicion_iva="responsable_inscripto", email=None):
    comprobantes = FakeComprobanteRepository()
    pagos = FakePagoRepository()
    empresas = FakeEmpresaService(condicion_iva)
    service = ComprobanteService(
        comprobantes,
        pagos,
        empresas,
        email,
        id_empresa="EMP-0001",
    )
    service.empresa_fake = empresas
    pago_service = PagoService(comprobantes, pagos)
    return service, pago_service, comprobantes, pagos


def test_emitir_desde_enviado_calcula_tipo_y_saldo() -> None:
    service, _pagos, _repo, _pago_repo = _services()

    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    assert comprobante["tipo_comprobante"] == "B"
    assert comprobante["numero_completo"] == "0001-00000001"
    assert comprobante["estado_pago"] == "emitida"
    assert comprobante["monto"] == Decimal("100.00")
    assert comprobante["saldo_pendiente"] == Decimal("100.00")
    assert comprobante["total_pagado"] == Decimal("0")
    assert comprobante["cliente"]["dni_cuit"] == "20111111112"


def test_emitir_es_idempotente() -> None:
    service, _pagos, _repo, _pago_repo = _services()

    primero = service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")
    segundo = service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")

    assert primero["id_comprobante_venta"] == segundo["id_comprobante_venta"]


def test_respuestas_de_comprobante_incluyen_cliente_email() -> None:
    service, _pagos, _repo, _pago_repo = _services()

    emitido = service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")
    resumen = service.listar(None, None, 50, 0)[0]

    assert emitido["cliente_email"] == "cliente@example.com"
    assert resumen["cliente_email"] == "cliente@example.com"
    ComprobanteVentaRead.model_validate(emitido)
    ComprobanteVentaResumen.model_validate(resumen)


def test_comprobante_emitido_es_inmutable() -> None:
    service, _pagos, repo, _pago_repo = _services()
    emitido = service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")
    id_comprobante = emitido["id_comprobante_venta"]

    # Modificaciones posteriores en el pedido, el cliente, la empresa y el
    # catálogo no deben alterar el comprobante ya emitido.
    repo.pedido["cliente_nombre"] = "Cliente Modificado"
    repo.pedido["cliente_email"] = "nuevo@example.com"
    repo.pedido["entrega_calle"] = "Otra calle"
    repo.pedido["estado_envio"] = "entregado"
    repo.pedido["total"] = Decimal("999.00")
    repo.pedido["items"][0]["producto_nombre"] = "Producto modificado"
    repo.pedido["items"][0]["precio_unitario"] = Decimal("999.00")
    service.empresa_fake.empresa["razon_social"] = "Empresa modificada"
    service.empresa_fake.empresa["cuit"] = "20999999999"

    actual = service.obtener(id_comprobante)

    assert actual["cliente"]["nombre"] == "Cliente"
    assert actual["cliente"]["email"] == "cliente@example.com"
    assert actual["cliente_email"] == "cliente@example.com"
    assert actual["entrega_calle"] == "Test"
    assert actual["estado_envio"] == "enviado"
    assert actual["monto"] == Decimal("100.00")
    assert actual["empresa"]["razon_social"] == "Empresa de prueba"
    assert actual["empresa"]["cuit"] == "20111111112"
    assert actual["items"][0]["producto_nombre"] == "Producto"
    assert actual["items"][0]["precio_unitario"] == Decimal("100.00")
    assert repo.items_guardados[0]["producto_nombre"] == "Producto"
    ComprobanteVentaRead.model_validate(actual)


def test_emitir_permite_pedido_recien_creado() -> None:
    service, _pagos, repo, _pago_repo = _services()
    repo.pedido = _pedido("pendiente")

    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    assert comprobante["estado_pago"] == "emitida"


def test_emitir_rechaza_pedido_cancelado() -> None:
    service, _pagos, repo, _pago_repo = _services()
    repo.pedido = _pedido("cancelado")

    with pytest.raises(ComprobanteEstadoInvalido):
        service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")


def test_tipo_a_para_cliente_responsable_inscripto() -> None:
    service, _pagos, repo, _pago_repo = _services()
    repo.pedido = _pedido("entregado", codigo_iva="1")

    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    assert comprobante["tipo_comprobante"] == "A"


def test_tipo_c_para_emisor_monotributista() -> None:
    service, _pagos, _repo, _pago_repo = _services("monotributista")

    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    assert comprobante["tipo_comprobante"] == "C"


def test_calcular_tipo_comprobante() -> None:
    assert calcular_tipo_comprobante("responsable_inscripto", "1") == "A"
    assert calcular_tipo_comprobante("responsable_inscripto", "6") == "A"
    assert calcular_tipo_comprobante("responsable_inscripto", "5") == "B"
    assert calcular_tipo_comprobante("responsable_inscripto", "4") == "B"
    assert calcular_tipo_comprobante("monotributista", "1") == "C"
    assert calcular_tipo_comprobante("exento", "5") == "C"


def test_numeracion_es_correlativa_por_tipo() -> None:
    service, _pagos, repo, _pago_repo = _services()

    primero = service.emitir("PV-0001", ComprobanteVentaCreate(), "EMP-0001")
    repo.pedido = {**_pedido(), "id_pedido_cliente": "PV-0002"}
    repo.comprobante = None
    segundo = service.emitir("PV-0002", ComprobanteVentaCreate(), "EMP-0001")

    assert primero["numero_comprobante"] == "00000001"
    assert segundo["numero_comprobante"] == "00000002"


def test_pago_parcial_y_total_actualiza_estado_y_saldo() -> None:
    service, pago_service, repo, _pago_repo = _services()
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    pago_service.registrar(
        comprobante["id_comprobante_venta"],
        PagoCreate(id_medio_pago="MPG-0001", monto=Decimal("40.00")),
    )
    parcial = service.obtener(comprobante["id_comprobante_venta"])
    assert parcial["estado_pago"] == "aprobada"
    assert parcial["saldo_pendiente"] == Decimal("60.00")
    assert repo.pedido_saldo == Decimal("60.00")

    pago_service.registrar(
        comprobante["id_comprobante_venta"],
        PagoCreate(id_medio_pago="MPG-0001", monto=Decimal("60.00")),
    )
    total = service.obtener(comprobante["id_comprobante_venta"])
    assert total["estado_pago"] == "pagada"
    assert total["saldo_pendiente"] == Decimal("0.00")
    assert total["total_pagado"] == Decimal("100.00")
    assert repo.pedido_saldo == Decimal("0.00")


def test_pago_que_excede_el_saldo_es_rechazado() -> None:
    service, pago_service, _repo, _pago_repo = _services()
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    with pytest.raises(PagoDatosInvalidos):
        pago_service.registrar(
            comprobante["id_comprobante_venta"],
            PagoCreate(id_medio_pago="MPG-0001", monto=Decimal("150.00")),
        )


def test_pago_rechazado_no_modifica_el_saldo() -> None:
    service, pago_service, repo, _pago_repo = _services()
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    pago_service.registrar(
        comprobante["id_comprobante_venta"],
        PagoCreate(
            id_medio_pago="MPG-0001",
            monto=Decimal("100.00"),
            estado="rechazado",
        ),
    )
    actual = service.obtener(comprobante["id_comprobante_venta"])

    assert actual["estado_pago"] == "emitida"
    assert actual["saldo_pendiente"] == Decimal("100.00")
    assert repo.pedido_saldo == Decimal("100.00")


def test_enviar_adjunta_pdf_y_registra_envio() -> None:
    email = FakeEmailService()
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    envio = service.enviar(comprobante["id_comprobante_venta"])

    assert envio["estado"] == "enviado"
    assert envio["destinatario"] == "cliente@example.com"
    assert len(email.enviados) == 1
    adjunto = email.enviados[0]["adjuntos"][0]
    assert adjunto.tipo_mime == "application/pdf"
    assert adjunto.contenido.startswith(b"%PDF-")
    assert len(repo.envios) == 1


def test_enviar_usa_destinatario_explicito() -> None:
    email = FakeEmailService()
    service, _pagos, _repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    envio = service.enviar(
        comprobante["id_comprobante_venta"], "otro@example.com"
    )

    assert envio["destinatario"] == "otro@example.com"
    assert email.enviados[0]["destinatario"] == "otro@example.com"


def test_enviar_reenvia_copias_y_las_registra() -> None:
    email = FakeEmailService()
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    envio = service.enviar(
        comprobante["id_comprobante_venta"],
        "otro@example.com",
        ["cc1@example.com", "cc2@example.com"],
        ["bcc@example.com"],
    )

    assert envio["cc"] == ["cc1@example.com", "cc2@example.com"]
    assert envio["bcc"] == ["bcc@example.com"]
    assert email.enviados[0]["cc"] == ["cc1@example.com", "cc2@example.com"]
    assert email.enviados[0]["bcc"] == ["bcc@example.com"]
    assert repo.envios[0]["cc"] == ["cc1@example.com", "cc2@example.com"]
    assert repo.envios[0]["bcc"] == ["bcc@example.com"]


def test_enviar_registra_copias_en_intento_fallido() -> None:
    email = FakeEmailService(error=ErrorEnvioEmail("timeout"))
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    with pytest.raises(ComprobanteEnvioFallido):
        service.enviar(
            comprobante["id_comprobante_venta"],
            None,
            ["cc@example.com"],
            ["bcc@example.com"],
        )

    assert repo.envios[0]["estado"] == "fallido"
    assert repo.envios[0]["cc"] == ["cc@example.com"]
    assert repo.envios[0]["bcc"] == ["bcc@example.com"]


def test_enviar_sin_destinatario_es_invalido() -> None:
    email = FakeEmailService()
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )
    repo.comprobante["cliente_email"] = ""

    with pytest.raises(ComprobanteEnvioSinDestinatario):
        service.enviar(comprobante["id_comprobante_venta"])


def test_enviar_sin_smtp_configurado_registra_fallido() -> None:
    email = FakeEmailService(error=EmailNoConfigurado("sin smtp"))
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    with pytest.raises(ComprobanteEnvioNoConfigurado):
        service.enviar(comprobante["id_comprobante_venta"])

    assert repo.envios[0]["estado"] == "fallido"


def test_enviar_con_error_smtp_registra_fallido() -> None:
    email = FakeEmailService(error=ErrorEnvioEmail("timeout"))
    service, _pagos, repo, _pago_repo = _services(email=email)
    comprobante = service.emitir(
        "PV-0001", ComprobanteVentaCreate(), "EMP-0001"
    )

    with pytest.raises(ComprobanteEnvioFallido):
        service.enviar(comprobante["id_comprobante_venta"])

    assert repo.envios[0]["estado"] == "fallido"
    assert repo.envios[0]["error"] == "timeout"
