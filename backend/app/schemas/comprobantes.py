from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import SchemaBase
from app.schemas.empresas import EmpresaRead
from app.schemas.pagos import PagoRead
from app.schemas.validaciones import normalizar_email

_DireccionCopia = Annotated[str, Field(max_length=160)]


class ComprobanteVentaCreate(SchemaBase):
    observaciones: str = Field(default="", max_length=500)


class ComprobanteEnvioInput(SchemaBase):
    destinatario: str | None = Field(default=None, max_length=160)
    cc: list[_DireccionCopia] = Field(default_factory=list, max_length=5)
    bcc: list[_DireccionCopia] = Field(default_factory=list, max_length=5)

    @field_validator("destinatario")
    @classmethod
    def validar_destinatario(cls, valor: str | None) -> str | None:
        return normalizar_email(valor) if valor else None

    @field_validator("cc", "bcc")
    @classmethod
    def validar_copias(cls, valores: list[str]) -> list[str]:
        return [normalizar_email(valor) for valor in valores]

    @model_validator(mode="after")
    def deduplicar_destinatarios(self) -> "ComprobanteEnvioInput":
        vistos: set[str] = {self.destinatario} if self.destinatario else set()
        cc: list[str] = []
        for email in self.cc:
            if email not in vistos:
                cc.append(email)
                vistos.add(email)
        self.cc = cc
        bcc: list[str] = []
        for email in self.bcc:
            if email not in vistos:
                bcc.append(email)
                vistos.add(email)
        self.bcc = bcc
        return self


class ComprobanteClienteRead(SchemaBase):
    id_cliente: str
    nombre: str
    apellido: str
    dni_cuit: str
    email: str
    telefono: str
    condicion_iva_codigo: str
    condicion_iva_descripcion: str


class ComprobanteItemRead(SchemaBase):
    id_producto: str
    producto_nombre: str
    cantidad: Decimal
    descuento_producto: Decimal
    iva: Decimal
    neto: Decimal
    precio_unitario: Decimal
    subtotal: Decimal
    tipo_iva: str


class ComprobanteVentaResumen(SchemaBase):
    id_comprobante_venta: str
    numero_comprobante: str | None
    numero_completo: str | None
    punto_venta: str
    tipo_comprobante: Literal["A", "B", "C", "E"]
    estado_pago: Literal["emitida", "aprobada", "pagada", "rechazada"]
    fecha_emision: date
    monto: Decimal
    saldo_pendiente: Decimal
    id_pedido_cliente: str
    cliente_nombre: str
    cliente_apellido: str
    cliente_email: str
    id_empresa: str
    empresa_razon_social: str


class ComprobanteVentaRead(ComprobanteVentaResumen):
    fecha_pago: date | None
    total_pagado: Decimal
    estado_envio: Literal["pendiente", "proceso", "enviado", "entregado", "cancelado"]
    descuento_compra: Decimal
    entrega_calle: str
    entrega_altura: str
    entrega_cp: str
    entrega_depto: str
    entrega_localidad: str
    entrega_provincia: str
    observaciones: str
    cae: str | None
    cae_vence: date | None
    creado_en: datetime
    empresa: EmpresaRead
    cliente: ComprobanteClienteRead
    items: list[ComprobanteItemRead]
    pagos: list[PagoRead]
