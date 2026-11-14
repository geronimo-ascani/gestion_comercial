from datetime import date, datetime
import re
from typing import Literal

from pydantic import Field, SecretStr, field_validator

from .base import SchemaBase, UpdateSchema

EmpleadoRol = Literal["ventas", "abastecimiento", "administrador"]


class EmpleadoCreate(SchemaBase):
    apellido: str = Field(min_length=1, max_length=120)
    dni_cuil: str = Field(min_length=1, max_length=20)
    email: str = Field(max_length=160)
    fecha_ingreso: date
    nombre: str = Field(min_length=1, max_length=120)
    password: SecretStr = Field(min_length=8, max_length=128)
    puesto: str = Field(min_length=1, max_length=80)
    rol: EmpleadoRol = "ventas"
    telefono: str = Field(min_length=1, max_length=40)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return _validar_email(valor)


class EmpleadoRead(SchemaBase):
    apellido: str
    dni_cuil: str
    email: str
    fecha_alta: datetime
    fecha_ingreso: date
    fecha_modificacion: datetime | None
    id_empleado: str
    nombre: str
    puesto: str
    rol: EmpleadoRol
    telefono: str


class EmpleadoUpdate(UpdateSchema):
    apellido: str | None = Field(default=None, min_length=1, max_length=120)
    dni_cuil: str | None = Field(default=None, min_length=1, max_length=20)
    email: str | None = Field(default=None, max_length=160)
    fecha_ingreso: date | None = None
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    puesto: str | None = Field(default=None, min_length=1, max_length=80)
    rol: EmpleadoRol | None = None
    telefono: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        return _validar_email(valor) if valor is not None else None


def _validar_email(valor: str) -> str:
    email = valor.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Debe ingresar un correo electrónico válido")
    return email
