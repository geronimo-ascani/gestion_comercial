import re
from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.base import SchemaBase, UpdateSchema
from app.schemas.clientes import DireccionEntidad, DireccionEntidadRead


class ProveedorFields(SchemaBase):
    razon_social: str = Field(min_length=1, max_length=160)
    cuit: str = Field(min_length=11, max_length=20)
    email: str = Field(max_length=160)
    telefono: str = Field(min_length=1, max_length=40)
    banco: str = Field(min_length=1, max_length=120)
    cuenta: str = Field(min_length=1, max_length=40)
    direccion: DireccionEntidad

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, valor: str) -> str:
        digitos = re.sub(r"[^0-9]", "", valor)
        if len(digitos) != 11:
            raise ValueError("El CUIT debe contener 11 dígitos")
        return digitos

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        email = valor.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Debe ingresar un correo electrónico válido")
        return email


class ProveedorCreate(ProveedorFields):
    pass


class ProveedorRead(ProveedorFields):
    direccion: DireccionEntidadRead
    id_proveedor: str
    saldo: Decimal


class ProveedorUpdate(UpdateSchema):
    razon_social: str | None = Field(default=None, min_length=1, max_length=160)
    cuit: str | None = Field(default=None, min_length=11, max_length=20)
    email: str | None = Field(default=None, max_length=160)
    telefono: str | None = Field(default=None, min_length=1, max_length=40)
    banco: str | None = Field(default=None, min_length=1, max_length=120)
    cuenta: str | None = Field(default=None, min_length=1, max_length=40)
    direccion: DireccionEntidad | None = None

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        digitos = re.sub(r"[^0-9]", "", valor)
        if len(digitos) != 11:
            raise ValueError("El CUIT debe contener 11 dígitos")
        return digitos

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        email = valor.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Debe ingresar un correo electrónico válido")
        return email
