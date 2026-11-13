import { apiRequest } from "~/lib/api";

import type { Product } from "./products-types";

export interface Categoria {
  id_categoria: string;
  nombre: string;
}

export interface AlicuotaIva {
  id_alicuota_iva: string;
  codigo_afip: string;
  descripcion: string;
  porcentaje: string;
  tipo_iva: string;
}

export interface Unidad {
  id_unidad: string;
  descripcion: string;
  unidad_venta: string;
}

export interface ProductoApi {
  id_producto: string;
  nombre: string;
  descripcion: string;
  estado: boolean;
  imagen: boolean;
  margen: string;
  precio_compra: string;
  precio_venta: string;
  stock_actual: string;
  stock_minimo: string;
  id_alicuota_iva: string;
  id_categoria: string;
  id_unidad: string;
  categoria_nombre: string;
  alicuota_descripcion: string;
  alicuota_porcentaje: string;
  alicuota_codigo_afip: string;
  alicuota_tipo_iva: string;
  unidad_descripcion: string;
  unidad_venta: string;
  stock_bajo: boolean;
}

export interface ProductoListadoApi {
  items: ProductoApi[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductoListado {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface MovimientoInventario {
  id_movimiento: string;
  cantidad: string;
  fecha_movimiento: string;
  motivo: "compra" | "venta" | "devolucion" | "ajuste";
  tipo: "entrada" | "salida";
  id_pedido_cliente: string | null;
  id_pedido_proveedor: string | null;
  id_producto: string;
  producto_nombre: string;
}

export type StockEstado = "todos" | "en_stock" | "critico" | "sin_stock";

export interface ProductoFiltros {
  q?: string;
  idCategoria?: string;
  idAlicuotaIva?: string;
  idUnidad?: string;
  precioMin?: number;
  precioMax?: number;
  stockEstado?: StockEstado;
  estado?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProductoCreatePayload {
  id_producto: string;
  nombre: string;
  descripcion: string;
  margen: number;
  precio_compra: number;
  stock_actual: number;
  stock_minimo: number;
  id_alicuota_iva: string;
  id_categoria: string;
  id_unidad?: string;
  estado?: boolean;
  imagen?: boolean;
}

export type ProductoUpdatePayload = Partial<
  Omit<ProductoCreatePayload, "id_producto" | "stock_actual">
>;

export interface MovimientoFiltros {
  desde?: string;
  hasta?: string;
  tipo?: "entrada" | "salida";
  motivo?: "compra" | "venta" | "devolucion" | "ajuste";
  limit?: number;
  offset?: number;
}

export interface AjusteStockPayload {
  tipo: "entrada" | "salida";
  cantidad: number;
}

function mapProducto(producto: ProductoApi): Product {
  return {
    id: producto.id_producto,
    code: producto.id_producto,
    name: producto.nombre,
    category: producto.categoria_nombre,
    categoryId: producto.id_categoria,
    description: producto.descripcion,
    purchasePrice: Number(producto.precio_compra),
    margin: Number(producto.margen),
    salePrice: Number(producto.precio_venta),
    stock: Number(producto.stock_actual),
    minStock: Number(producto.stock_minimo),
    alicuotaId: producto.id_alicuota_iva,
    alicuotaDescripcion: producto.alicuota_descripcion,
    alicuotaPorcentaje: Number(producto.alicuota_porcentaje),
    stockBajo: producto.stock_bajo,
  };
}

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listarProductos(
  filtros: ProductoFiltros = {}
): Promise<ProductoListado> {
  const query = buildQuery({
    q: filtros.q?.trim() || undefined,
    id_categoria: filtros.idCategoria,
    id_alicuota_iva: filtros.idAlicuotaIva,
    id_unidad: filtros.idUnidad,
    precio_min: filtros.precioMin,
    precio_max: filtros.precioMax,
    stock_estado: filtros.stockEstado,
    estado: filtros.estado,
    limit: filtros.limit,
    offset: filtros.offset,
  });

  const data = await apiRequest<ProductoListadoApi>(`/productos${query}`);
  return { ...data, items: data.items.map(mapProducto) };
}

export async function obtenerProducto(id: string): Promise<Product> {
  const data = await apiRequest<ProductoApi>(
    `/productos/${encodeURIComponent(id)}`
  );
  return mapProducto(data);
}

export async function crearProducto(
  datos: ProductoCreatePayload
): Promise<Product> {
  const data = await apiRequest<ProductoApi>("/productos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
  return mapProducto(data);
}

export async function reservarCodigoProducto(): Promise<string> {
  const data = await apiRequest<{ id_producto: string }>("/productos/codigos", {
    method: "POST",
  });
  return data.id_producto;
}

export async function anularCodigoProducto(id: string): Promise<void> {
  await apiRequest<void>(
    `/productos/codigos/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function actualizarProducto(
  id: string,
  datos: ProductoUpdatePayload
): Promise<Product> {
  const data = await apiRequest<ProductoApi>(
    `/productos/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(datos),
    }
  );
  return mapProducto(data);
}

export async function eliminarProducto(
  id: string,
  definitivo = false
): Promise<void> {
  const query = definitivo ? "?definitivo=true" : "";
  await apiRequest<void>(`/productos/${encodeURIComponent(id)}${query}`, {
    method: "DELETE",
  });
}

export async function listarAlertasStock(
  limit = 50,
  offset = 0
): Promise<ProductoListado> {
  const query = buildQuery({ limit, offset });
  const data = await apiRequest<ProductoListadoApi>(
    `/productos/alertas-stock${query}`
  );
  return { ...data, items: data.items.map(mapProducto) };
}

export async function listarMovimientos(
  id: string,
  filtros: MovimientoFiltros = {}
): Promise<MovimientoInventario[]> {
  const query = buildQuery({
    desde: filtros.desde,
    hasta: filtros.hasta,
    tipo: filtros.tipo,
    motivo: filtros.motivo,
    limit: filtros.limit,
    offset: filtros.offset,
  });
  return apiRequest<MovimientoInventario[]>(
    `/productos/${encodeURIComponent(id)}/movimientos${query}`
  );
}

export async function ajustarStock(
  id: string,
  datos: AjusteStockPayload
): Promise<MovimientoInventario> {
  return apiRequest<MovimientoInventario>(
    `/productos/${encodeURIComponent(id)}/ajuste-stock`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  );
}

export async function listarCategorias(): Promise<Categoria[]> {
  return apiRequest<Categoria[]>("/categorias?limit=200");
}

export async function crearCategoria(nombre: string): Promise<Categoria> {
  return apiRequest<Categoria>("/categorias", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  });
}

export async function eliminarCategoria(id: string): Promise<void> {
  await apiRequest<void>(`/categorias/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listarAlicuotas(): Promise<AlicuotaIva[]> {
  return apiRequest<AlicuotaIva[]>("/alicuotas-iva");
}

export async function listarUnidades(): Promise<Unidad[]> {
  return apiRequest<Unidad[]>("/unidades");
}
