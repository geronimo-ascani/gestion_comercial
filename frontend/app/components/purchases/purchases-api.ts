import { apiRequest } from "~/lib/api";
import { formatMoney } from "~/lib/currency";

import type { LineItem } from "../sales/sales-types";
import { formatDate } from "../sales/sales-types";
import type { PurchaseOrder } from "./purchases-types";
export interface PurchasePaymentMethod {
  id_medio_pago: string;
  medio_pago: string;
  tipo_cobro: string;
}

interface PurchaseOrderLineApi {
  id_producto: string;
  producto_nombre: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
}

interface PurchaseOrderApi {
  id_pedido_proveedor: string;
  estado: PurchaseOrder["status"];
  fecha_pedido: string;
  fecha_recepcion: string | null;
  total: string;
  id_empleado: string;
  id_medio_pago: string;
  medio_pago: string;
  id_proveedor: string;
  proveedor_nombre: string;
  items: PurchaseOrderLineApi[];
}

export interface PurchaseOrderPayload {
  id_proveedor: string;
  id_medio_pago: string;
  items: {
    id_producto: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}

function mapPurchaseOrder(order: PurchaseOrderApi): PurchaseOrder {
  const items: LineItem[] = order.items.map((item) => ({
    sku: item.id_producto,
    product: item.producto_nombre,
    qty: Number(item.cantidad),
    unitPrice: formatMoney(Number(item.precio_unitario)),
    subtotal: formatMoney(Number(item.subtotal)),
  }));
  return {
    number: order.id_pedido_proveedor,
    providerId: order.id_proveedor,
    provider: order.proveedor_nombre,
    paymentMethodId: order.id_medio_pago,
    date: formatDate(new Date(`${order.fecha_pedido}T00:00:00`)),
    receivedDate: order.fecha_recepcion
      ? formatDate(new Date(`${order.fecha_recepcion}T00:00:00`))
      : undefined,
    items,
    total: formatMoney(Number(order.total)),
    status: order.estado,
  };
}

export function listPurchasePaymentMethods(): Promise<PurchasePaymentMethod[]> {
  return apiRequest<PurchasePaymentMethod[]>("/medios-pago");
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const orders = await apiRequest<PurchaseOrderApi[]>(
    "/compras/pedidos?limit=200"
  );
  return orders.map(mapPurchaseOrder);
}

export async function createPurchaseOrder(
  payload: PurchaseOrderPayload
): Promise<PurchaseOrder> {
  const order = await apiRequest<PurchaseOrderApi>("/compras/pedidos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapPurchaseOrder(order);
}

export async function receivePurchaseOrder(
  id: string
): Promise<PurchaseOrder> {
  const order = await apiRequest<PurchaseOrderApi>(
    `/compras/pedidos/${encodeURIComponent(id)}/recepcion`,
    { method: "POST" }
  );
  return mapPurchaseOrder(order);
}

export async function cancelPurchaseOrder(
  id: string
): Promise<PurchaseOrder> {
  const order = await apiRequest<PurchaseOrderApi>(
    `/compras/pedidos/${encodeURIComponent(id)}/cancelacion`,
    { method: "POST" }
  );
  return mapPurchaseOrder(order);
}
