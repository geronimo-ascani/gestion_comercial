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
  const [total, setTotal] = useState(editing?.total ?? "$0");
  const [expiresError, setExpiresError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    const preselected = (location.state as { clienteId?: string } | null)
      ?.clienteId;
    if (preselected) setClient(preselected);
  }, [location.state]);

  useEffect(() => {
    setClient(editing?.clientId ?? "");
    setExpires(editing ? formatDateForInput(editing.expires) : "");
    setItems(editing?.items ?? []);
    setTotal(editing?.total ?? "$0");
    setExpiresError(null);
    setItemsError(null);
    setClientError(null);
  }, [editNumber, editing]);

  function handleItemsChange(nextItems: LineItem[], nextTotal: string) {
    setItems(nextItems);
    setTotal(nextTotal);
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
    const customer = customers.find((item) => item.id === client);
    const budgetData = {
      client: customer ? `${customer.firstName} ${customer.lastName}` : "Sin definir",
      clientId: client,
      expires: formatInputDate(expires),
      items,
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
              />
              <FieldError message={itemsError} />
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