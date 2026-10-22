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
import { formatDateForInput, formatDate, formatInputDate } from "./sales-types";
import { addBudget, updateBudget, useBudgets } from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { useCustomers } from "../customers/customers-store";
import { useProducts } from "../products/products-store";

export function NewBudgetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const budgets = useBudgets();
  const customers = useCustomers();
  const products = useProducts();
  const [searchParams] = useSearchParams();

  const editNumber = searchParams.get("edit");
  const editing = editNumber
    ? (budgets.find((budget) => budget.number === editNumber) ?? null)
    : null;

  const nextBudgetNumber = `PST-${String(budgets.length + 1).padStart(3, "0")}`;
  const backTo = "/sales?tab=budgets";

  const [client, setClient] = useState(editing?.clientId ?? "");
  const [expires, setExpires] = useState(
    editing ? formatDateForInput(editing.expires) : ""
  );
  const [items, setItems] = useState<LineItem[]>(editing?.items ?? []);
  const [subtotal, setSubtotal] = useState(
    editing?.subtotal ?? editing?.total ?? "$0"
  );
  const [discount, setDiscount] = useState(
    editing?.discount ? String(parsePercentInput(editing.discount)) : "0"
  );
  const [expiresError, setExpiresError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const discountPercent = parsePercentInput(discount);
  const { amount: discountAmount, total: totalValue } =
    computePercentageDiscount(
      parseNumberInput(subtotal),
      discountPercent
    );
  const total = formatMoney(totalValue);

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
      editing?.discount ? String(parsePercentInput(editing.discount)) : "0"
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) {
      setClientError("Seleccione un cliente");
      return;
    }
    if (!expires) {
      setExpiresError("La fecha de vencimiento es obligatoria");
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
    const customer = customers.find((item) => item.id === client);
    const budgetData = {
      client: customer ? `${customer.firstName} ${customer.lastName}` : "Sin definir",
      clientId: client,
      expires: formatInputDate(expires),
      items,
      subtotal: formatMoney(parseNumberInput(subtotal)),
      discount: discountPercent > 0 ? `${discountPercent}%` : undefined,
      total,
    };
    if (editing) {
      updateBudget(editing.number, budgetData);
    } else {
      addBudget({
        number: nextBudgetNumber,
        ...budgetData,
        date: formatDate(new Date()),
        status: "pendiente",
      });
    }
    navigate(backTo);
  }

  return (
    <FormPage
      backLabel="Volver a Ventas"
      backTo={backTo}
      title={editing ? `Editar presupuesto ${editing.number}` : "Nuevo presupuesto"}
      description="Cargue el cliente, la fecha de vencimiento y los productos. Al crear el presupuesto, el comprobante se envía automáticamente por email al cliente."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
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
                  value={expires}
                  onChange={(event) => {
                    setExpires(event.target.value);
                    setExpiresError(null);
                  }}
                  aria-invalid={!!expiresError}
                />
                <FieldError message={expiresError} />
              </div>
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
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                key={editing ? editing.number : "new"}
                products={products}
                priceMode="sale"
                initialItems={editing?.items}
                onChange={handleItemsChange}
                summaryLabel="Subtotal de productos"
              />
              <FieldError message={itemsError} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-discount">Descuento (%)</Label>
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
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{subtotal}</span>
                  </div>
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
            <Button type="submit">
              {editing ? "Guardar cambios" : "Crear presupuesto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}