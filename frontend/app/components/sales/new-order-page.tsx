import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FormPage } from "~/components/ui/form-page";
import { Combobox } from "~/components/ui/combobox";

import {
  computePercentageDiscount,
  formatMoney,
  parseNumberInput,
  parsePercentInput,
} from "~/lib/currency";
import type { LineItem, OrderDraft, PaymentMethod } from "./sales-types";
import { formatDate } from "./sales-types";
import { addOrder, updateBudget, updateOrder, useBudgets, useOrders } from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { applyOrderStock, applyOrderStockDelta, stockValidationMessage } from "./sales-stock";
import { useCustomers } from "../customers/customers-store";
import { useProducts } from "../products/products-store";
import { createInvoiceFromOrder, usePayments } from "../payments/payments-store";
import { usePaymentMethods } from "../payments/payment-methods-store";

export function NewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orders = useOrders();
  const budgets = useBudgets();
  const customers = useCustomers();
  const products = useProducts();
  const payments = usePayments();
  const paymentMethods = usePaymentMethods();
  const [searchParams] = useSearchParams();

  const editNumber = searchParams.get("edit");
  const editing = editNumber
    ? (orders.find((order) => order.number === editNumber) ?? null)
    : null;
  const fromBudgetNumber = searchParams.get("fromBudget");
  const sourceBudget =
    !editing && fromBudgetNumber
      ? (budgets.find((budget) => budget.number === fromBudgetNumber) ?? null)
      : null;

  const nextOrderNumber = `PV-${String(orders.length + 1).padStart(3, "0")}`;
  const backTo = "/sales?tab=orders";

  const [client, setClient] = useState(
    editing?.clientId ?? sourceBudget?.clientId ?? ""
  );
  const [province, setProvince] = useState(
    editing?.deliveryAddress.province ?? ""
  );
  const [locality, setLocality] = useState(
    editing?.deliveryAddress.locality ?? ""
  );
  const [street, setStreet] = useState(editing?.deliveryAddress.street ?? "");
  const [number, setNumber] = useState(editing?.deliveryAddress.number ?? "");
  const [apartment, setApartment] = useState(
    editing?.deliveryAddress.apartment ?? ""
  );
  const [payment, setPayment] = useState<PaymentMethod>(
    editing?.payment ?? "tarjeta"
  );
  const [items, setItems] = useState<LineItem[]>(
    editing?.items ?? sourceBudget?.items ?? []
  );
  const [subtotal, setSubtotal] = useState(
    editing?.subtotal ??
      sourceBudget?.subtotal ??
      editing?.total ??
      sourceBudget?.total ??
      "$0"
  );
  const [discount, setDiscount] = useState(
    editing?.discount
      ? String(parsePercentInput(editing.discount))
      : sourceBudget?.discount
        ? String(parsePercentInput(sourceBudget.discount))
        : "0"
  );
  const [addressErrors, setAddressErrors] = useState<
    Record<string, string | null>
  >({});
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const discountPercent = parsePercentInput(discount);
  const subtotalValue = parseNumberInput(subtotal);
  const lineDiscountTotal = Math.max(
    0,
    Math.round(
      (items.reduce(
        (sum, item) => sum + item.qty * parseNumberInput(item.unitPrice),
        0
      ) -
        subtotalValue) *
        100
    ) / 100
  );
  const { amount: discountAmount, total: totalValue } =
    computePercentageDiscount(
      subtotalValue,
      discountPercent
    );
  const total = formatMoney(totalValue);

  function prefillAddressFromCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    setProvince(customer.address.province);
    setLocality(customer.address.locality);
    setStreet(customer.address.street);
    setNumber(customer.address.number);
    setApartment(customer.address.apartment);
    setAddressErrors({});
  }

  useEffect(() => {
    const preselected = (location.state as { clienteId?: string } | null)
      ?.clienteId;
    if (preselected) {
      setClient(preselected);
      prefillAddressFromCustomer(preselected);
    }
  }, [location.state]);

  useEffect(() => {
    setClient(editing?.clientId ?? sourceBudget?.clientId ?? "");
    setProvince(editing?.deliveryAddress.province ?? "");
    setLocality(editing?.deliveryAddress.locality ?? "");
    setStreet(editing?.deliveryAddress.street ?? "");
    setNumber(editing?.deliveryAddress.number ?? "");
    setApartment(editing?.deliveryAddress.apartment ?? "");
    setPayment(editing?.payment ?? "tarjeta");
    setItems(editing?.items ?? sourceBudget?.items ?? []);
    setSubtotal(
      editing?.subtotal ??
        sourceBudget?.subtotal ??
        editing?.total ??
        sourceBudget?.total ??
        "$0"
    );
    setDiscount(
      editing?.discount
        ? String(parsePercentInput(editing.discount))
        : sourceBudget?.discount
          ? String(parsePercentInput(sourceBudget.discount))
          : "0"
    );
    setAddressErrors({});
    setItemsError(null);
    setClientError(null);
    setDiscountError(null);
    if (sourceBudget && !editing) {
      prefillAddressFromCustomer(sourceBudget.clientId ?? "");
    }
  }, [editNumber, editing, fromBudgetNumber, sourceBudget]);

  // Restaura el borrador cuando se vuelve del formulario de medios de pago.
  useEffect(() => {
    const navState = location.state as
      | { draft?: OrderDraft; selectPaymentMethod?: string }
      | null;
    if (!navState?.draft && !navState?.selectPaymentMethod) return;
    const draft = navState.draft;
    if (draft) {
      setClient(draft.client);
      setProvince(draft.province);
      setLocality(draft.locality);
      setStreet(draft.street);
      setNumber(draft.number);
      setApartment(draft.apartment);
      setItems(draft.items);
      setSubtotal(draft.subtotal);
      setDiscount(draft.discount);
      setPayment(draft.payment);
    }
    if (navState.selectPaymentMethod) {
      setPayment(navState.selectPaymentMethod);
    }
    setAddressErrors({});
    setItemsError(null);
    setClientError(null);
    setDiscountError(null);
  }, [location.state]);

  function handleAddPaymentMethod() {
    const draft: OrderDraft = {
      client,
      province,
      locality,
      street,
      number,
      apartment,
      payment,
      items,
      subtotal,
      discount,
    };
    navigate("/payments/new-method", {
      state: {
        backTo: `${location.pathname}${location.search}`,
        draft,
      },
    });
  }

  function handleItemsChange(nextItems: LineItem[], nextSubtotal: string) {
    setItems(nextItems);
    setSubtotal(nextSubtotal);
    setItemsError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextAddressErrors: Record<string, string | null> = {
      province: !province.trim() ? "La provincia es obligatoria" : null,
      locality: !locality.trim() ? "La localidad es obligatoria" : null,
      street: !street.trim()
        ? "La calle es obligatoria"
        : street.trim().length < 3
          ? "Dirección demasiado corta"
          : !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(street)
            ? "Debe incluir el nombre de la calle"
            : null,
      number: !number.trim()
        ? "La altura es obligatoria"
        : !/^\d+$/.test(number.trim())
          ? "Altura inválida"
          : null,
    };
    setAddressErrors(nextAddressErrors);
    if (Object.values(nextAddressErrors).some(Boolean)) return;
    if (!client) {
      setClientError("Seleccione un cliente");
      return;
    }
    if (items.length === 0) {
      setItemsError("Agregue al menos un producto con cantidad.");
      return;
    }
    if (discountPercent < 0 || discountPercent > 100) {
      setDiscountError("El descuento debe estar entre 0 y 100%");
      return;
    }
    const stockError = stockValidationMessage(items, products);
    if (stockError) {
      setItemsError(stockError);
      return;
    }
    const customer = customers.find((item) => item.id === client);
    const orderData = {
      client: customer ? `${customer.firstName} ${customer.lastName}` : "Sin definir",
      clientId: client,
      email: customer?.email,
      phone: customer?.phone,
      deliveryAddress: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
      items,
      subtotal: formatMoney(parseNumberInput(subtotal)),
      discount: discountPercent > 0 ? `${discountPercent}%` : undefined,
      total,
      payment,
    };
    if (editing) {
      applyOrderStockDelta(editing.items, items);
      updateOrder(editing.number, orderData);
      navigate(backTo);
      return;
    }
    applyOrderStock(items);
    const newOrder = {
      number: nextOrderNumber,
      ...orderData,
      date: formatDate(new Date()),
      status: "pendiente" as const,
      paymentStatus: "pendiente" as const,
    };
    addOrder(newOrder);
    const invoiceNumber = createInvoiceFromOrder(newOrder);
    updateOrder(newOrder.number, { invoiceNumber });
    if (sourceBudget && sourceBudget.status !== "convertido") {
      updateBudget(sourceBudget.number, { status: "convertido" });
    }
    navigate(`/sales/${nextOrderNumber}`);
  }

  if (
    editing &&
    (editing.paymentStatus === "pagado" ||
      payments.some(
        (payment) =>
          payment.orderNumber === editing.number &&
          payment.status === "aprobado"
      ))
  ) {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={`Pedido ${editing.number}`}
        description="Este pedido ya tiene un pago registrado y no puede editarse."
      >
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">
              El pedido {editing.number} tiene un pago registrado, por lo que no
              puede modificarse.
            </p>
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Volver a Ventas
            </Button>
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver a Ventas"
      backTo={backTo}
      title={
        editing
          ? `Editar pedido ${editing.number}`
          : sourceBudget
            ? `Nuevo pedido desde presupuesto ${sourceBudget.number}`
            : "Nuevo pedido de venta"
      }
      description={
        sourceBudget
          ? `Cliente y productos precargados del presupuesto ${sourceBudget.number}. Complete los datos obligatorios del pedido (dirección de entrega y método de pago). Al crear el pedido, el comprobante se envía automáticamente por email al cliente.`
          : "Cargue el cliente, los productos y el método de pago. Al crear el pedido, el comprobante se envía automáticamente por email al cliente."
      }
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-client">Cliente</Label>
                <Combobox
                  id="order-client"
                  value={client}
                  onValueChange={(customerId) => {
                    setClient(customerId);
                    setClientError(null);
                    prefillAddressFromCustomer(customerId);
                  }}
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: `${customer.firstName} ${customer.lastName}`,
                    description: customer.document || undefined,
                    keywords: [
                      customer.document,
                      customer.email,
                      customer.phone,
                    ].filter((item): item is string => Boolean(item)),
                  }))}
                  placeholder="Seleccionar cliente"
                  searchPlaceholder="Buscar cliente por nombre, DNI o correo..."
                  notFoundText="No se encontraron clientes"
                  emptyText="No hay clientes cargados"
                  ariaInvalid={!!clientError}
                />
                <FieldError message={clientError} />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() =>
                    navigate("/customers/new", {
                      state: { backTo: "/sales/new-order" },
                    })
                  }
                >
                  <Plus />
                  Nuevo cliente
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dirección de entrega</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="order-street">Calle</Label>
                  <Input
                    id="order-street"
                    value={street}
                    onChange={(event) => {
                      setStreet(event.target.value);
                      setAddressErrors((prev) => ({ ...prev, street: null }));
                    }}
                    placeholder="Nombre de la calle"
                    aria-invalid={!!addressErrors.street}
                  />
                  <FieldError message={addressErrors.street} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-number">Altura</Label>
                  <Input
                    id="order-number"
                    value={number}
                    onChange={(event) => {
                      setNumber(event.target.value.replace(/\D/g, ""));
                      setAddressErrors((prev) => ({ ...prev, number: null }));
                    }}
                    placeholder="1234"
                    aria-invalid={!!addressErrors.number}
                  />
                  <FieldError message={addressErrors.number} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-apartment">Departamento</Label>
                  <Input
                    id="order-apartment"
                    value={apartment}
                    onChange={(event) => {
                      setApartment(event.target.value);
                      setAddressErrors((prev) => ({ ...prev, apartment: null }));
                    }}
                    placeholder="Ej. 3º B"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-locality">Localidad</Label>
                  <Input
                    id="order-locality"
                    value={locality}
                    onChange={(event) => {
                      setLocality(event.target.value);
                      setAddressErrors((prev) => ({ ...prev, locality: null }));
                    }}
                    placeholder="Ej. Córdoba"
                    aria-invalid={!!addressErrors.locality}
                  />
                  <FieldError message={addressErrors.locality} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-province">Provincia</Label>
                  <Input
                    id="order-province"
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      setAddressErrors((prev) => ({ ...prev, province: null }));
                    }}
                    placeholder="Ej. Buenos Aires"
                    aria-invalid={!!addressErrors.province}
                  />
                  <FieldError message={addressErrors.province} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                key={
                  editing
                    ? editing.number
                    : sourceBudget
                      ? `budget-${sourceBudget.number}`
                      : "new"
                }
                products={products}
                priceMode="sale"
                initialItems={editing?.items ?? sourceBudget?.items}
                onChange={handleItemsChange}
                summaryLabel="Subtotal de productos"
                allowLineDiscount
              />
              <FieldError message={itemsError} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-discount">Descuento (%)</Label>
                <Input
                  id="order-discount"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discount}
                  onChange={(event) => {
                    setDiscount(event.target.value);
                    setDiscountError(null);
                  }}
                  placeholder="0"
                  aria-invalid={!!discountError}
                />
                <FieldError message={discountError} />
              </div>
              <div className="flex items-end">
                <div className="w-full space-y-1 rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {lineDiscountTotal > 0
                        ? formatMoney(subtotalValue + lineDiscountTotal)
                        : subtotal}
                    </span>
                  </div>
                  {lineDiscountTotal > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Descuento por línea</span>
                      <span className="tabular-nums">
                        − {formatMoney(lineDiscountTotal)}
                      </span>
                    </div>
                  )}
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Descuento ({discountPercent}%)</span>
                      <span className="tabular-nums">
                        − {formatMoney(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{total}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-payment">Método de pago</Label>
              <div className="flex gap-2">
                <Select
                  value={payment}
                  onValueChange={(value) => setPayment(value as PaymentMethod)}
                >
                  <SelectTrigger id="order-payment" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((paymentMethod) => (
                      <SelectItem key={paymentMethod.id} value={paymentMethod.id}>
                        {paymentMethod.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  aria-label="Agregar medio de pago"
                  title="Agregar medio de pago"
                  onClick={handleAddPaymentMethod}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editing ? "Guardar cambios" : "Crear pedido"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}