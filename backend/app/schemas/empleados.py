from datetime import date, datetime

from pydantic import SecretStr

from .base import SchemaBase, UpdateSchema


class EmpleadoFields(SchemaBase):
    apellido: str
    dni_cuil: str
    email: str
    fecha_alta: datetime
    fecha_ingreso: date
    fecha_modificacion: datetime | None = None
    nombre: str
    puesto: str
    rol: str
    telefono: str


class EmpleadoCreate(EmpleadoFields):
    password: SecretStr


class EmpleadoRead(EmpleadoFields):
    id_empleado: str


class EmpleadoUpdate(UpdateSchema):
    apellido: str | None = None
    dni_cuil: str | None = None
    email: str | None = None
    fecha_alta: datetime | None = None
    fecha_ingreso: date | None = None
    fecha_modificacion: datetime | None = None
    nombre: str | None = None
    puesto: str | None = None
    rol: str | None = None
    telefono: str | None = None
    password: SecretStr | None = None
