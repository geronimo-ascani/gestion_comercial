import { apiRequest } from "~/lib/api";

export type TipoCuenta = "cliente" | "proveedor";

export interface CuentasCorrientesFiltros {
  desde: string;
  hasta: string;
  id_cliente?: string;
  id_proveedor?: string;
}

interface ParametrosApi {
  desde: string;
  hasta: string;
  id_cliente?: string | null;
  id_proveedor?: string | null;
}

interface MovimientoApi {
  id_movimiento: string;
  tipo_movimiento: "comprobante" | "pago" | "factura";
  id_origen: string;
  numero: string | null;
  fecha: string;
  descripcion: string;
  monto: string;
  signo: -1 | 1;
  saldo_resultante: string;
  id_medio_pago: string | null;
  medio_pago: string | null;
}

interface ResumenClienteApi {
  id_cliente: string;
  nombre: string;
  apellido: string;
  dni_cuit: string;
  saldo_inicial: string;
  total_cargo: string;
  total_abono: string;
  saldo_final: string;
  cantidad_comprobantes: number;
  cantidad_pagos: number;
  ultima_actividad: string | null;
}

interface ResumenProveedorApi {
  id_proveedor: string;
  razon_social: string;
  cuit: string;
  saldo_inicial: string;
  total_cargo: string;
  total_abono: string;
  saldo_final: string;
  cantidad_facturas: number;
  cantidad_pagos: number;
  ultima_actividad: string | null;
}

interface TotalesApi {
  saldo_inicial: string;
  total_cargo: string;
  total_abono: string;
  saldo_final: string;
  cantidad_operaciones: number;
  cantidad_entidades: number;
}

interface ListadoClientesApi {
  desde: string;
  hasta: string;
  generado_en: string;
  parametros: ParametrosApi;
  totales: TotalesApi;
  clientes: ResumenClienteApi[];
}

interface ListadoProveedoresApi {
  desde: string;
  hasta: string;
  generado_en: string;
  parametros: ParametrosApi;
  totales: TotalesApi;
  proveedores: ResumenProveedorApi[];
}

interface DetalleClienteApi {
  desde: string;
  hasta: string;
  generado_en: string;
  parametros: ParametrosApi;
  cliente: ResumenClienteApi & { movimientos: MovimientoApi[] };
}

interface DetalleProveedorApi {
  desde: string;
  hasta: string;
  generado_en: string;
  parametros: ParametrosApi;
  proveedor: ResumenProveedorApi & { movimientos: MovimientoApi[] };
}

export interface MovimientoCuenta {
  id: string;
  tipo: "comprobante" | "pago" | "factura";
  idOrigen: string;
  numero: string | null;
  fecha: string;
  descripcion: string;
  monto: number;
  signo: -1 | 1;
  saldoResultante: number;
  medioPago: string | null;
}

export interface ResumenCuenta {
  id: string;
  nombre: string;
  documento: string;
  saldoInicial: number;
  totalCargo: number;
  totalAbono: number;
  saldoFinal: number;
  cantidadDocumentos: number;
  cantidadPagos: number;
  ultimaActividad: string | null;
}

export interface TotalesCuenta {
  saldoInicial: number;
  totalCargo: number;
  totalAbono: number;
  saldoFinal: number;
  cantidadOperaciones: number;
  cantidadEntidades: number;
}

export interface ListadoCuentas {
  desde: string;
  hasta: string;
  parametros: CuentasCorrientesFiltros;
  totales: TotalesCuenta;
  resumenes: ResumenCuenta[];
}

export interface DetalleCuenta {
  desde: string;
  hasta: string;
  resumen: ResumenCuenta;
  movimientos: MovimientoCuenta[];
}

function query(filtros: CuentasCorrientesFiltros, tipo: TipoCuenta): string {
  const params = new URLSearchParams({
    desde: filtros.desde,
    hasta: filtros.hasta,
  });
  const clave = tipo === "cliente" ? "id_cliente" : "id_proveedor";
  const valor = filtros[clave];
  if (valor) params.set(clave, valor);
  return params.toString();
}

function parametrosMapeados(parametros: ParametrosApi): CuentasCorrientesFiltros {
  return {
    desde: parametros.desde,
    hasta: parametros.hasta,
    ...(parametros.id_cliente ? { id_cliente: parametros.id_cliente } : {}),
    ...(parametros.id_proveedor ? { id_proveedor: parametros.id_proveedor } : {}),
  };
}

function mapTotales(totales: TotalesApi): TotalesCuenta {
  return {
    saldoInicial: Number(totales.saldo_inicial),
    totalCargo: Number(totales.total_cargo),
    totalAbono: Number(totales.total_abono),
    saldoFinal: Number(totales.saldo_final),
    cantidadOperaciones: totales.cantidad_operaciones,
    cantidadEntidades: totales.cantidad_entidades,
  };
}

function mapResumenCliente(resumen: ResumenClienteApi): ResumenCuenta {
  return {
    id: resumen.id_cliente,
    nombre: `${resumen.nombre} ${resumen.apellido}`.trim(),
    documento: resumen.dni_cuit,
    saldoInicial: Number(resumen.saldo_inicial),
    totalCargo: Number(resumen.total_cargo),
    totalAbono: Number(resumen.total_abono),
    saldoFinal: Number(resumen.saldo_final),
    cantidadDocumentos: resumen.cantidad_comprobantes,
    cantidadPagos: resumen.cantidad_pagos,
    ultimaActividad: resumen.ultima_actividad,
  };
}

function mapResumenProveedor(resumen: ResumenProveedorApi): ResumenCuenta {
  return {
    id: resumen.id_proveedor,
    nombre: resumen.razon_social,
    documento: resumen.cuit,
    saldoInicial: Number(resumen.saldo_inicial),
    totalCargo: Number(resumen.total_cargo),
    totalAbono: Number(resumen.total_abono),
    saldoFinal: Number(resumen.saldo_final),
    cantidadDocumentos: resumen.cantidad_facturas,
    cantidadPagos: resumen.cantidad_pagos,
    ultimaActividad: resumen.ultima_actividad,
  };
}

function mapMovimiento(movimiento: MovimientoApi): MovimientoCuenta {
  return {
    id: movimiento.id_movimiento,
    tipo: movimiento.tipo_movimiento,
    idOrigen: movimiento.id_origen,
    numero: movimiento.numero,
    fecha: movimiento.fecha,
    descripcion: movimiento.descripcion,
    monto: Number(movimiento.monto),
    signo: movimiento.signo,
    saldoResultante: Number(movimiento.saldo_resultante),
    medioPago: movimiento.medio_pago,
  };
}

function mapListado(
  datos: ListadoClientesApi | ListadoProveedoresApi,
  tipo: TipoCuenta
): ListadoCuentas {
  const resumenes =
    tipo === "cliente"
      ? (datos as ListadoClientesApi).clientes.map(mapResumenCliente)
      : (datos as ListadoProveedoresApi).proveedores.map(mapResumenProveedor);
  return {
    desde: datos.desde,
    hasta: datos.hasta,
    parametros: parametrosMapeados(datos.parametros),
    totales: mapTotales(datos.totales),
    resumenes,
  };
}

export async function listarCuentas(
  tipo: TipoCuenta,
  filtros: CuentasCorrientesFiltros
): Promise<ListadoCuentas> {
  const ruta = tipo === "cliente" ? "clientes" : "proveedores";
  const datos = await apiRequest<ListadoClientesApi | ListadoProveedoresApi>(
    `/cuentas-corrientes/${ruta}?${query(filtros, tipo)}`
  );
  return mapListado(datos, tipo);
}

export async function obtenerCuenta(
  tipo: TipoCuenta,
  id: string,
  filtros: CuentasCorrientesFiltros
): Promise<DetalleCuenta> {
  const ruta = tipo === "cliente" ? "clientes" : "proveedores";
  const datos = await apiRequest<DetalleClienteApi | DetalleProveedorApi>(
    `/cuentas-corrientes/${ruta}/${encodeURIComponent(id)}?${query(filtros, tipo)}`
  );
  const detalle = datos as DetalleClienteApi | DetalleProveedorApi;
  const entidad =
    tipo === "cliente"
      ? (detalle as DetalleClienteApi).cliente
      : (detalle as DetalleProveedorApi).proveedor;
  const resumen =
    tipo === "cliente"
      ? mapResumenCliente(entidad as ResumenClienteApi)
      : mapResumenProveedor(entidad as ResumenProveedorApi);
  return {
    desde: detalle.desde,
    hasta: detalle.hasta,
    resumen,
    movimientos: entidad.movimientos.map(mapMovimiento),
  };
}

export function filtrosPorDefecto(): CuentasCorrientesFiltros {
  const hoy = new Date();
  const hasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return {
    desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`,
    hasta,
  };
}
