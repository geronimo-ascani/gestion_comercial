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
  computePercentageDiscount,
  formatMoney,
  parseNumberInput,
  parsePercentInput,
} from "~/lib/currency";
import type { LineItem } from "./sales-types";
import { formatDate, formatDateForInput, formatInputDate } from "./sales-types";
import {
  createBudget,
  loadBudgets,
  updateBudget,
  useBudgets,
} from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { refreshCustomers, useCustomers } from "../customers/customers-store";
import {
  refreshProducts,
  useProducts,
} from "../products/products-store";
import { useCurrentUser } from "../auth/session-store";

export function NewBudgetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const budgets = useBudgets();
  const customers = useCustomers();
  const products = useProducts();
  const currentUser = useCurrentUser();
  const canCreateCustomers = ["administrador", "ventas"].includes(
    currentUser?.role ?? "",
  );
  const [searchParams] = useSearchParams();
  const editNumber = searchParams.get("edit");
  const editing = editNumber
    ? (budgets.find((budget) => budget.number === editNumber) ?? null)
    : null;
  const backTo = "/sales?tab=budgets";

  const [client, setClient] = useState(editing?.clientId ?? "");
  const [expires, setExpires] = useState(
    editing ? formatDateForInput(editing.expires) : "",
  );
  const [items, setItems] = useState<LineItem[]>(editing?.items ?? []);
  const [subtotal, setSubtotal] = useState(
    editing?.subtotal ?? editing?.total ?? "$0",
  );
  const [discount, setDiscount] = useState(
    editing?.discount ? String(parsePercentInput(editing.discount)) : "0",
  );
  const [expiresError, setExpiresError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const discountPercent = parsePercentInput(discount);
  const subtotalValue = parseNumberInput(subtotal);
  const editorItems = (editing?.items ?? []).map((item) => {
    const product = products.find(
      (candidate) =>
        candidate.id === item.sku || candidate.code === item.sku,
    );
    return product
      ? { ...item, unitPrice: formatMoney(product.salePrice) }
      : item;
  });
  const lineDiscountTotal = Math.max(
    0,
    Math.round(
      (items.reduce(
        (sum, item) => sum + item.qty * parseNumberInput(item.unitPrice),
        0,
      ) -
        subtotalValue) *
        100,
    ) / 100,
  );
  const { amount: discountAmount, total: totalValue } =
    computePercentageDiscount(subtotalValue, discountPercent);
  const total = formatMoney(totalValue);
  const today = formatDateForInput(formatDate(new Date()));

  useEffect(() => {
    void Promise.allSettled([
      loadBudgets(),
      refreshCustomers(),
      refreshProducts(),
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
              : "No se pudieron cargar los datos necesarios.",
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const preselected = (location.state as { clienteId?: string } | null)
      ?.clienteId;
    if (preselected) setClient(preselected);
  }, [location.state]);

  useEffect(() => {
    setClient(editing?.clientId ?? "");
    setExpires(editing ? formatDateForInput(editing.expires) : "");
    setItems(editing?.items ?? []);
    setSubtotal(editing?.subtotal ?? editing?.total ?? "$0");
    setDiscount(
      editing?.discount ? String(parsePercentInput(editing.discount)) : "0",
    );
    setExpiresError(null);
    setItemsError(null);
    setClientError(null);
    setDiscountError(null);
  }, [editNumber, editing]);

  function handleItemsChange(nextItems: LineItem[], nextSubtotal: string) {
    setItems(nextItems);
    setSubtotal(nextSubtotal);
    setItemsError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    if (!client) {
      setClientError("Seleccione un cliente");
      return;
    }
    if (!expires || expires < today) {
      setExpiresError("La fecha de vencimiento debe ser hoy o posterior");
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

    const payload = {
      id_cliente: client,
      ...(editing
        ? { fecha_muestra: formatDateForInput(editing.date) }
        : {}),
      fecha_vencimiento: expires,
      descuento_compra: String(discountPercent),
      items: items.map((item) => {
        const product = products.find(
          (candidate) =>
            candidate.id === item.sku || candidate.code === item.sku,
        );
        return {
          id_producto: product?.id ?? item.sku ?? "",
          cantidad: String(item.qty),
          descuento_producto: String(
            parsePercentInput(item.discount ?? "0"),
          ),
        };
      }),
    };

    if (payload.items.some((item) => !item.id_producto)) {
      setItemsError("Seleccione un producto válido en cada renglón.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = editing
        ? await updateBudget(editing.number, payload)
        : await createBudget(payload);
      navigate(`/sales?tab=budgets&created=${encodeURIComponent(saved.number)}`);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el presupuesto.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={editNumber ? `Editar presupuesto ${editNumber}` : "Nuevo presupuesto"}
      >
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            Cargando datos…
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  if (editNumber && (!editing || editing.status !== "pendiente")) {
    return (
      <FormPage
        backLabel="Volver a Ventas"
        backTo={backTo}
        title={`Presupuesto ${editNumber}`}
      >
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">
              {requestError ??
                "Solo se pueden editar presupuestos pendientes."}
            </p>
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Volver a presupuestos
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
      title={editing ? `Editar presupuesto ${editing.number}` : "Nuevo presupuesto"}
      description="Los precios y los importes se calculan y guardan en el servidor. El presupuesto no reserva stock."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            {requestError && (
              <p
                className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                role="alert"
              >
                {requestError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-client">Cliente</Label>
                <Combobox
                  id="budget-client"
                  value={client}
                  onValueChange={(customerId) => {
                    setClient(customerId);
                    setClientError(null);
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
              <div className="space-y-2">
                <Label htmlFor="budget-expires">Fecha de vencimiento</Label>
                <Input
                  id="budget-expires"
                  type="date"
                  min={today}
                  value={expires}
                  onChange={(event) => {
                    setExpires(event.target.value);
                    setExpiresError(null);
                  }}
                  aria-invalid={!!expiresError}
                />
                <FieldError message={expiresError} />
              </div>
              {canCreateCustomers && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    type="button"
                    onClick={() =>
                      navigate("/customers/new", {
                        state: { backTo: "/sales/new-budget" },
                      })
                    }
                  >
                    <Plus />
                    Nuevo cliente
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                key={editing ? editing.number : "new"}
                products={products}
                priceMode="sale"
                initialItems={editorItems}
                onChange={handleItemsChange}
                summaryLabel="Subtotal de productos"
                allowLineDiscount
                allowPriceEdit={false}
                showStock={false}
              />
              <FieldError message={itemsError} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-discount">Descuento general (%)</Label>
                <Input
                  id="budget-discount"
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
                    <span className="text-muted-foreground">
                      Subtotal tras descuentos por línea
                    </span>
                    <span className="tabular-nums">{subtotal}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Descuento general ({discountPercent}%)</span>
                      <span className="tabular-nums">
                        − {formatMoney(discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border pt-1 font-semibold">
                    <span>Total cotizado</span>
                    <span className="tabular-nums">{total}</span>
                  </div>
                  {lineDiscountTotal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      El subtotal ya contempla descuentos por producto.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => navigate(backTo)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear presupuesto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}
