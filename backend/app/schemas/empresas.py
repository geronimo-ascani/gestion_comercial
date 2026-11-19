import re
from datetime import date
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.base import SchemaBase, UpdateSchema

CondicionIVAEmisor = Literal[
    "responsable_inscripto",
    "monotributista",
    "exento",
]


def _normalizar_cuit(valor: str, *, obligatorio: bool = True) -> str:
    digitos = re.sub(r"[^0-9]", "", valor)
    if not digitos and not obligatorio:
        return ""
    if len(digitos) != 11:
        raise ValueError("El CUIT debe contener 11 dígitos")
    return digitos


def _normalizar_punto_venta(valor: str) -> str:
    if not valor.isdigit():
        raise ValueError("El punto de venta debe contener solo números")
    return valor.zfill(5)


def _validar_email(valor: str) -> str:
    email = valor.strip().lower()
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Debe ingresar un correo electrónico válido")
    return email


class EmpresaFields(SchemaBase):
    razon_social: str = Field(min_length=1, max_length=160)
    nombre_fantasia: str = Field(default="", max_length=160)
    cuit: str = Field(min_length=11, max_length=20)
    condicion_iva: CondicionIVAEmisor
    domicilio: str = Field(default="", max_length=200)
    punto_venta: str = Field(default="0001", max_length=5)
    email: str = Field(default="", max_length=160)
    telefono: str = Field(default="", max_length=40)
    activa: bool = True
    ingresos_brutos: str = Field(default="", max_length=40)
    inicio_actividades: date | None = None
    codigo_postal: str = Field(default="", max_length=10)
    localidad: str = Field(default="", max_length=120)
    provincia: str = Field(default="", max_length=120)

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, valor: str) -> str:
        return _normalizar_cuit(valor, obligatorio=True)

    @field_validator("punto_venta")
    @classmethod
    def validar_punto_venta(cls, valor: str) -> str:
        return _normalizar_punto_venta(valor)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return _validar_email(valor)


class EmpresaCreate(EmpresaFields):
    pass


class EmpresaUpdate(UpdateSchema):
    razon_social: str | None = Field(default=None, min_length=1, max_length=160)
    nombre_fantasia: str | None = Field(default=None, max_length=160)
    cuit: str | None = Field(default=None, max_length=20)
    condicion_iva: CondicionIVAEmisor | None = None
    domicilio: str | None = Field(default=None, max_length=200)
    punto_venta: str | None = Field(default=None, max_length=5)
    email: str | None = Field(default=None, max_length=160)
    telefono: str | None = Field(default=None, max_length=40)
    activa: bool | None = None
    ingresos_brutos: str | None = Field(default=None, max_length=40)
    inicio_actividades: date | None = None
    codigo_postal: str | None = Field(default=None, max_length=10)
    localidad: str | None = Field(default=None, max_length=120)
    provincia: str | None = Field(default=None, max_length=120)

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, valor: str | None) -> str | None:
        return None if valor is None else _normalizar_cuit(valor, obligatorio=True)

    @field_validator("punto_venta")
    @classmethod
    def validar_punto_venta(cls, valor: str | None) -> str | None:
        return None if valor is None else _normalizar_punto_venta(valor)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        return None if valor is None else _validar_email(valor)


class EmpresaRead(SchemaBase):
    id_empresa: str
    razon_social: str
    nombre_fantasia: str
    cuit: str
    condicion_iva: CondicionIVAEmisor
    domicilio: str
    punto_venta: str
    email: str
    telefono: str
    activa: bool
    ingresos_brutos: str
    inicio_actividades: date | None
    codigo_postal: str
    localidad: str
    provincia: str
