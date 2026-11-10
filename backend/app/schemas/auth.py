from datetime import date, datetime
import re
from typing import Literal

from pydantic import Field, SecretStr, field_validator

from .base import SchemaBase


class CredencialesLogin(SchemaBase):
    email: str = Field(max_length=160)
    password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return _validar_email(valor)


class RegistroEmpleado(SchemaBase):
    apellido: str = Field(min_length=1, max_length=120)
    dni_cuil: str = Field(min_length=1, max_length=20)
    email: str = Field(max_length=160)
    fecha_ingreso: date
    nombre: str = Field(min_length=1, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=128)
    rol: Literal["ventas", "abastecimiento", "administrador"] = "ventas"
    telefono: str = Field(min_length=1, max_length=40)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return _validar_email(valor)


class UsuarioRead(SchemaBase):
    apellido: str
    dni_cuil: str
    email: str
    fecha_alta: datetime
    fecha_ingreso: date
    fecha_modificacion: datetime | None
    id_empleado: str
    nombre: str
    puesto: str
    rol: Literal["ventas", "abastecimiento", "administrador"]
    telefono: str


class TokenRead(SchemaBase):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class RegistroResponse(SchemaBase):
    access_token: str | None = None
    token_type: Literal["bearer"] = "bearer"
    user: UsuarioRead


class SolicitudRecuperacion(SchemaBase):
    email: str = Field(max_length=160)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return _validar_email(valor)


class RestablecerContrasena(SchemaBase):
    token: str = Field(min_length=32, max_length=256)
    password: SecretStr = Field(min_length=8, max_length=128)


def _validar_email(valor: str) -> str:
    email = valor.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Debe ingresar un correo electrónico válido")
    return email
