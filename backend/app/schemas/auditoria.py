from datetime import datetime

from .base import SchemaBase


class LogAuditoriaFields(SchemaBase):
    accion: str
    data_anterior: str | None = None
    data_nueva: str | None = None
    entidad_afectada: str
    fecha_hora: datetime
    id_entidad: str
    id_empleado: str


class LogAuditoriaCreate(LogAuditoriaFields):
    pass


class LogAuditoriaRead(LogAuditoriaFields):
    id_log: str
