from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from .base import SchemaBase


class CuentasCorrientesParametrosClientes(SchemaBase):
    desde: date
    hasta: date
    id_cliente: str | None = None


class CuentasCorrientesParametrosProveedores(SchemaBase):
    desde: date
    hasta: date
    id_proveedor: str | None = None


class MovimientoCuentaCorrienteRead(SchemaBase):
    id_movimiento: str
    tipo_movimiento: Literal["comprobante", "pago", "factura"]
    id_origen: str
    numero: str | None
    fecha: date
    descripcion: str
    monto: Decimal
    signo: Literal[-1, 1]
    saldo_resultante: Decimal
    id_medio_pago: str | None = None
    medio_pago: str | None = None


class TotalesCuentaCorrienteRead(SchemaBase):
    saldo_inicial: Decimal
    total_cargo: Decimal
    total_abono: Decimal
    saldo_final: Decimal
    cantidad_operaciones: int
    cantidad_entidades: int


class ResumenCuentaClienteRead(SchemaBase):
    id_cliente: str
    nombre: str
    apellido: str
    dni_cuit: str
    saldo_inicial: Decimal
    total_cargo: Decimal
    total_abono: Decimal
    saldo_final: Decimal
    cantidad_comprobantes: int
    cantidad_pagos: int
    ultima_actividad: date | None


class DetalleCuentaClienteRead(ResumenCuentaClienteRead):
    movimientos: list[MovimientoCuentaCorrienteRead]


class CuentasCorrientesClientesRead(SchemaBase):
    desde: date
    hasta: date
    generado_en: datetime
    parametros: CuentasCorrientesParametrosClientes
    totales: TotalesCuentaCorrienteRead
    clientes: list[ResumenCuentaClienteRead]


class DetalleCuentasClientesRead(SchemaBase):
    desde: date
    hasta: date
    generado_en: datetime
    parametros: CuentasCorrientesParametrosClientes
    cliente: DetalleCuentaClienteRead


class ResumenCuentaProveedorRead(SchemaBase):
    id_proveedor: str
    razon_social: str
    cuit: str
    saldo_inicial: Decimal
    total_cargo: Decimal
    total_abono: Decimal
    saldo_final: Decimal
    cantidad_facturas: int
    cantidad_pagos: int
    ultima_actividad: date | None


class DetalleCuentaProveedorRead(ResumenCuentaProveedorRead):
    movimientos: list[MovimientoCuentaCorrienteRead]


class CuentasCorrientesProveedoresRead(SchemaBase):
    desde: date
    hasta: date
    generado_en: datetime
    parametros: CuentasCorrientesParametrosProveedores
    totales: TotalesCuentaCorrienteRead
    proveedores: list[ResumenCuentaProveedorRead]


class DetalleCuentasProveedoresRead(SchemaBase):
    desde: date
    hasta: date
    generado_en: datetime
    parametros: CuentasCorrientesParametrosProveedores
    proveedor: DetalleCuentaProveedorRead
