import { apiRequest } from "~/lib/api";
import { formatMoney } from "~/lib/currency";

import type {
  Budget,
  BudgetStatus,
  OrderStatus,
  SalesOrder,
} from "./sales-types";
import { formatInputDate } from "./sales-types";

interface SalesOrderLineApi {
  id_producto: string;
  producto_nombre: string;
  cantidad: string;
  descuento_producto: string;
  iva: string;
  neto: string;
  precio_unitario: string;
  subtotal: string;
  tipo_iva: string;
}

interface SalesOrderApi {
  id_pedido_cliente: string;
  descuento_compra: string;
  entrega_altura: string;
  entrega_calle: string;
  entrega_cp: string;
  entrega_depto: string;
  entrega_localidad: string;
  entrega_provincia: string;
  estado_envio: OrderStatus;
  fecha_emision: string;
  fecha_muestra: string;
  saldo_pendiente: string;
  total: string;
  id_cliente: string;
  cliente_nombre: string;
  cliente_apellido: string;
  cliente_email: string;
  cliente_telefono: string;
  id_presupuesto_cliente: string | null;
  items: SalesOrderLineApi[];
}

type PresupuestoLineaApi = SalesOrderLineApi;

interface PresupuestoApi {
  id_presupuesto_cliente: string;
  estado: BudgetStatus;
  fecha_creacion: string;
  fecha_muestra: string;
  fecha_vencimiento: string;
  descuento_compra: string;
  total: string;
  id_cliente: string;
  cliente_nombre: string;
  cliente_apellido: string;
  items: PresupuestoLineaApi[];
}

export interface SalesOrderPayload {
  id_cliente: string;
  entrega_provincia: string;
  entrega_localidad: string;
  entrega_calle: string;
  entrega_altura: string;
  entrega_cp: string;
  entrega_depto: string;
  descuento_compra: number;
  items: {
    id_producto: string;
    cantidad: number;
    descuento_producto: number;
  }[];
}

export interface PresupuestoPayload {
  id_cliente: string;
  fecha_muestra?: string;
  fecha_vencimiento: string;
  descuento_compra: string;
  items: {
    id_producto: string;
    cantidad: string;
    descuento_producto: string;
  }[];
}

export interface PresupuestoConversionPayload {
  entrega_provincia: string;
  entrega_localidad: string;
  entrega_calle: string;
  entrega_altura: string;
  entrega_cp: string;
  entrega_depto: string;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mapSalesOrder(order: SalesOrderApi): SalesOrder {
  const items = order.items.map((item) => {
    const discount = Number(item.descuento_producto);
    const quantity = Number(item.cantidad);
    const unitPrice = Number(item.precio_unitario);
    const lineGross = roundMoney(quantity * unitPrice);
    const discountAmount = roundMoney(lineGross * discount / 100);
    return {
      sku: item.id_producto,
      product: item.producto_nombre,
      qty: quantity,
      unitPrice: formatMoney(unitPrice),
      discount: discount > 0 ? `${discount}%` : undefined,
      discountAmount:
        discountAmount > 0 ? formatMoney(discountAmount) : undefined,
      subtotal: formatMoney(Number(item.subtotal)),
    };
  });
  const subtotalBeforeOrderDiscount = roundMoney(
    order.items.reduce((sum, item) => {
      const base = roundMoney(
        Number(item.cantidad) * Number(item.precio_unitario)
      );
      return (
        sum +
        roundMoney(
          base * (1 - Number(item.descuento_producto) / 100)
        )
      );
    }, 0)
  );
  const orderDiscount = Number(order.descuento_compra);

  return {
    number: order.id_pedido_cliente,
    client: `${order.cliente_nombre} ${order.cliente_apellido}`,
    clientId: order.id_cliente,
    email: order.cliente_email,
    phone: order.cliente_telefono,
    date: formatInputDate(order.fecha_muestra),
    deliveryAddress: {
      province: order.entrega_provincia,
      locality: order.entrega_localidad,
      street: order.entrega_calle,
      number: order.entrega_altura,
      apartment: order.entrega_depto,
    },
    items,
    subtotal: formatMoney(subtotalBeforeOrderDiscount),
    discount: orderDiscount > 0 ? `${orderDiscount}%` : undefined,
    total: formatMoney(Number(order.total)),
    status: order.estado_envio,
    payment: "",
    paymentStatus: "pendiente",
  };
}

function mapPresupuesto(presupuesto: PresupuestoApi): Budget {
  const discountPercent = Number(presupuesto.descuento_compra);
  const items = presupuesto.items.map((item) => {
    const quantity = Number(item.cantidad);
    const unitPrice = Number(item.precio_unitario);
    const lineDiscount = Number(item.descuento_producto);
    const gross = roundMoney(quantity * unitPrice);
    const discountAmount = roundMoney(gross * lineDiscount / 100);
    return {
      sku: item.id_producto,
      product: item.producto_nombre,
      qty: quantity,
      unitPrice: formatMoney(unitPrice),
      discount: lineDiscount > 0 ? `${lineDiscount}%` : undefined,
      discountAmount:
        discountAmount > 0 ? formatMoney(discountAmount) : undefined,
      subtotal: formatMoney(gross - discountAmount),
    };
  });
  const subtotal = roundMoney(
    presupuesto.items.reduce((sum, item) => {
      const gross = roundMoney(
        Number(item.cantidad) * Number(item.precio_unitario),
      );
      return sum + roundMoney(
        gross * (1 - Number(item.descuento_producto) / 100),
      );
    }, 0),
  );

  return {
    number: presupuesto.id_presupuesto_cliente,
    client: `${presupuesto.cliente_nombre} ${presupuesto.cliente_apellido}`,
    clientId: presupuesto.id_cliente,
    date: formatInputDate(presupuesto.fecha_muestra),
    expires: formatInputDate(presupuesto.fecha_vencimiento),
    items,
    subtotal: formatMoney(subtotal),
    discount:
      discountPercent > 0 ? `${discountPercent}%` : undefined,
    total: formatMoney(Number(presupuesto.total)),
    status: presupuesto.estado,
  };
}

export async function listSalesOrders(): Promise<SalesOrder[]> {
  const orders = await apiRequest<SalesOrderApi[]>("/ventas/pedidos?limit=200");
  return orders.map(mapSalesOrder);
}

export async function listBudgets(): Promise<Budget[]> {
  const budgets = await apiRequest<PresupuestoApi[]>(
    "/ventas/presupuestos?limit=200",
  );
  return budgets.map(mapPresupuesto);
}

export async function getBudget(id: string): Promise<Budget> {
  const budget = await apiRequest<PresupuestoApi>(
    `/ventas/presupuestos/${encodeURIComponent(id)}`,
  );
  return mapPresupuesto(budget);
}

export async function createBudget(
  payload: PresupuestoPayload,
): Promise<Budget> {
  const budget = await apiRequest<PresupuestoApi>("/ventas/presupuestos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapPresupuesto(budget);
}

export async function updateBudget(
  id: string,
  payload: PresupuestoPayload,
): Promise<Budget> {
  const budget = await apiRequest<PresupuestoApi>(
    `/ventas/presupuestos/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return mapPresupuesto(budget);
}

export async function approveBudget(id: string): Promise<Budget> {
  const budget = await apiRequest<PresupuestoApi>(
    `/ventas/presupuestos/${encodeURIComponent(id)}/aprobacion`,
    { method: "POST" },
  );
  return mapPresupuesto(budget);
}

export async function deleteBudget(id: string): Promise<void> {
  await apiRequest<void>(
    `/ventas/presupuestos/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function convertBudget(
  id: string,
  payload: PresupuestoConversionPayload,
): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>(
    `/ventas/presupuestos/${encodeURIComponent(id)}/conversion`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return mapSalesOrder(order);
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>(
    `/ventas/pedidos/${encodeURIComponent(id)}`
  );
  return mapSalesOrder(order);
}

export async function createSalesOrder(
  payload: SalesOrderPayload
): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>("/ventas/pedidos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapSalesOrder(order);
}

export async function updateSalesOrder(
  id: string,
  payload: SalesOrderPayload
): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>(
    `/ventas/pedidos/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  return mapSalesOrder(order);
}

export async function advanceSalesOrder(
  id: string,
  estado_envio: Extract<OrderStatus, "proceso" | "enviado" | "entregado">
): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>(
    `/ventas/pedidos/${encodeURIComponent(id)}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({ estado_envio }),
    }
  );
  return mapSalesOrder(order);
}

export async function cancelSalesOrder(id: string): Promise<SalesOrder> {
  const order = await apiRequest<SalesOrderApi>(
    `/ventas/pedidos/${encodeURIComponent(id)}/cancelacion`,
    { method: "POST" }
  );
  return mapSalesOrder(order);
}
