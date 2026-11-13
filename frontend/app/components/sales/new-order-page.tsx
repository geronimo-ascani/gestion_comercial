import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import { Combobox } from "~/components/ui/combobox";

import {
  formatMoney,
  parseNumberInput,
  parsePercentInput,
} from "~/lib/currency";
import type { LineItem } from "./sales-types";
import {
  createSalesOrder,
  loadSalesOrders,
  updateSalesOrder,
  useOrders,
} from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { stockValidationMessage } from "./sales-stock";
import { refreshCustomers, useCustomers } from "../customers/customers-store";
import {
  invalidateProducts,
  refreshProducts,
  useProducts,
} from "../products/products-store";
import { useCurrentUser } from "../auth/session-store";

export function NewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orders = useOrders();
  const customers = useCustomers();
  const currentUser = useCurrentUser();
  const canCreateCustomers = ["administrador", "ventas"].includes(
    currentUser?.role ?? ""
  );
  const products = useProducts();
  const [searchParams] = useSearchParams();

  const editNumber = searchParams.get("edit");
  const editing = editNumber
    ? (orders.find((order) => order.number === editNumber) ?? null)
    : null;
  const backTo = "/sales?tab=orders";

  const [client, setClient] = useState(editing?.clientId ?? "");
  const [province, setProvince] = useState(editing?.deliveryAddress.province ?? "");
  const [locality, setLocality] = useState(editing?.deliveryAddress.locality ?? "");
  const [street, setStreet] = useState(editing?.deliveryAddress.street ?? "");
  const [number, setNumber] = useState(editing?.deliveryAddress.number ?? "");
  const [apartment, setApartment] = useState(
    editing?.deliveryAddress.apartment ?? "",
  );
  const [items, setItems] = useState<LineItem[]>(
    editing?.items ?? [],
  );
  const [subtotal, setSubtotal] = useState(
    editing?.subtotal ?? editing?.total ?? "$0",
  );
  const [discount, setDiscount] = useState(
    editing?.discount
      ? String(parsePercentInput(editing.discount))
      : "0",
  );
  const [addressErrors, setAddressErrors] = useState<
    Record<string, string | null>
  >({});
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const editReservedStock = new Map<string, number>();
  for (const item of editing?.items ?? []) {
    const product = products.find(
      (candidate) => candidate.id === item.sku || candidate.code === item.sku,
    );
    if (product) {
      editReservedStock.set(
        product.id,
        (editReservedStock.get(product.id) ?? 0) + item.qty,
      );
    }
  }
  const formProducts = products.map((product) => ({
    ...product,
    stock: product.stock + (editReservedStock.get(product.id) ?? 0),
  }));
  const editorItems = (editing?.items ?? []).map((item) => {
    const product = products.find(
      (candidate) => candidate.id === item.sku || candidate.code === item.sku,
    );
    return product
      ? { ...item, unitPrice: formatMoney(product.salePrice) }
      : item;
  });

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
  const totalValue = items.reduce((sum, item) => {
    const lineSubtotal = parseNumberInput(item.subtotal);
    return (
      sum +
      Math.round(
        lineSubtotal * (1 - discountPercent / 100) * 100,
      ) /
        100
    );
  }, 0);
  const discountAmount =
    Math.round((subtotalValue - totalValue) * 100) / 100;
  const total = formatMoney(totalValue);

  useEffect(() => {
    void Promise.allSettled([
      loadSalesOrders(),
      refreshProducts(),
      refreshCustomers(),
    ])
      .then((results) => {
        const failed = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failed) {
        setRequestError(
          failed.reason instanceof Error
            ? failed.reason.message
            : "No se pudieron cargar los datos necesarios para el pedido.",
        );
        }
      })
      .finally(() => setOrdersLoading(false));
  }, []);

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
  }, [location.state, customers]);

  useEffect(() => {
    if (!editNumber) return;
    setClient(editing?.clientId ?? "");
    setProvince(editing?.deliveryAddress.province ?? "");
    setLocality(editing?.deliveryAddress.locality ?? "");
    setStreet(editing?.deliveryAddress.street ?? "");
    setNumber(editing?.deliveryAddress.number ?? "");
    setApartment(editing?.deliveryAddress.apartment ?? "");
    setItems(editing?.items ?? []);
    setSubtotal(editing?.subtotal ?? editing?.total ?? "$0");
    setDiscount(
      editing?.discount
        ? String(parsePercentInput(editing.discount))
        : "0",
    );
    setAddressErrors({});
    setItemsError(null);
    setClientError(null);
    setDiscountError(null);
    setRequestError(null);
  }, [editNumber, editing]);

  function handleItemsChange(nextItems: LineItem[], nextSubtotal: string) {
    setItems(nextItems);
    setSubtotal(nextSubtotal);
    setItemsError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    if (
      items.some((item) => {
        const lineDiscount = parsePercentInput(item.discount ?? "0");
        return lineDiscount < 0 || lineDiscount > 100;
      })
    ) {
      setItemsError("Los descuentos por producto deben estar entre 0 y 100%.");
      return;
    }
    const stockError = stockValidationMessage(items, formProducts);
    if (stockError) {
      setItemsError(stockError);
      return;
    }
    const payload = {
      id_cliente: client,
      entrega_provincia: province.trim(),
      entrega_localidad: locality.trim(),
      entrega_calle: street.trim(),
      entrega_altura: number.trim(),
      entrega_cp: "",
      entrega_depto: apartment.trim(),
      descuento_compra: discountPercent,
      items: items.map((item) => {
        const product = products.find(
          (candidate) =>
            candidate.id === item.sku || candidate.code === item.sku,
        );
        return {
          id_producto: product?.id ?? item.sku ?? "",
          cantidad: item.qty,
          descuento_producto: parsePercentInput(item.discount ?? "0"),
        };
      }),
    };

    setSubmitting(true);
    setRequestError(null);
    try {
      const saved = editing
        ? await updateSalesOrder(editing.number, payload)
        : await createSalesOrder(payload);
      invalidateProducts();
      navigate(`/sales/${saved.number}`);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "No se pudo guardar el pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retryOrderLoad() {
    setOrdersLoading(true);
    setRequestError(null);
    void loadSalesOrders(true)
      .catch((error: unknown) => {
        setRequestError(
          error instanceof Error ? error.message : "No se pudieron cargar los pedidos.",
        );
      })
      .finally(() => setOrdersLoading(false));
  }

  if (ordersLoading) {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={editNumber ? `Editar pedido ${editNumber}` : "Nuevo pedido de venta"}
      >
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            Cargando pedidos…
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  if (editNumber && !editing) {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={`Pedido ${editNumber}`}
        description={requestError ?? "No se encontró el pedido solicitado."}
      >
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className={requestError ? "text-destructive" : "text-muted-foreground"} role={requestError ? "alert" : undefined}>
              {requestError ?? `No se encontró el pedido ${editNumber}.`}
            </p>
            <Button
              variant="outline"
              onClick={requestError ? retryOrderLoad : () => navigate(backTo)}
            >
              {requestError ? "Reintentar" : "Volver a Ventas"}
            </Button>
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  if (editing && editing.status !== "pendiente") {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={`Pedido ${editing.number}`}
        description="Solo se pueden editar pedidos pendientes."
      >
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">
              El pedido {editing.number} ya no está pendiente y no puede modificarse.
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
      title={editing ? `Editar pedido ${editing.number}` : "Nuevo pedido de venta"}
      description="Los precios y el stock se validan en el servidor. El pedido reserva stock al crearse."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <FieldError message={requestError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="order-client">Cliente</Label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
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
                  </div>
                  {canCreateCustomers && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11"
                      aria-label="Agregar cliente"
                      title="Agregar cliente"
                      onClick={() =>
                        navigate("/customers/new", {
                          state: { backTo: "/sales/new-order" },
                        })
                      }
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <FieldError message={clientError} />
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
                    ? `${editing.number}-${products.length}`
                    : "new"
                }
                products={formProducts}
                priceMode="sale"
                initialItems={editorItems}
                onChange={handleItemsChange}
                summaryLabel="Subtotal de productos"
                allowLineDiscount
                allowPriceEdit={false}
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

          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear pedido"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}