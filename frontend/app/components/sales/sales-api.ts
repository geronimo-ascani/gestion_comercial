import { apiRequest } from "~/lib/api";
import { formatMoney } from "~/lib/currency";

import type { OrderStatus, SalesOrder } from "./sales-types";
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

export async function listSalesOrders(): Promise<SalesOrder[]> {
  const orders = await apiRequest<SalesOrderApi[]>("/ventas/pedidos?limit=200");
  return orders.map(mapSalesOrder);
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
