import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

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

import type { LineItem } from "./sales-types";
import { formatDate, formatInputDate } from "./sales-types";
import { addBudget, useBudgets } from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { useCustomers } from "../customers/customers-store";
import { useProducts } from "../products/products-store";

export function NewBudgetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const budgets = useBudgets();
  const customers = useCustomers();
  const products = useProducts();

  const nextBudgetNumber = `PST-${String(budgets.length + 1).padStart(3, "0")}`;
  const backTo = "/sales?tab=budgets";

  const [client, setClient] = useState("");
  const [expires, setExpires] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [total, setTotal] = useState("$0");
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    const preselected = (location.state as { clienteId?: string } | null)
      ?.clienteId;
    if (preselected) setClient(preselected);
  }, [location.state]);

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
    if (items.length === 0) {
      setItemsError("Agregue al menos un producto con cantidad.");
      return;
    }
    const customer = customers.find((item) => item.id === client);
    addBudget({
      number: nextBudgetNumber,
      client: customer ? `${customer.firstName} ${customer.lastName}` : "Sin definir",
      date: formatDate(new Date()),
      expires: formatInputDate(expires),
      items,
      total,
      status: "pendiente",
    });
    navigate(backTo);
  }

  return (
    <FormPage
      backLabel="Volver a Ventas"
      backTo={backTo}
      title="Nuevo presupuesto"
      description="Cargue el cliente, la fecha de vencimiento y los productos. Al crear el presupuesto, el comprobante se envía automáticamente por email al cliente."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-client">Cliente</Label>
                <Select
                  value={client || undefined}
                  onValueChange={(value) => {
                    setClient(value ?? "");
                    setClientError(null);
                  }}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!clientError}>
                    <SelectValue placeholder="Seleccionar cliente">
                      {(selected) => {
                        if (!selected) return "Seleccionar cliente";
                        const picked = customers.find(
                          (item) => item.id === selected
                        );
                        return picked
                          ? `${picked.firstName} ${picked.lastName}`
                          : selected;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem
                        key={customer.id}
                        value={customer.id}
                        label={`${customer.firstName} ${customer.lastName}`}
                      >
                        {customer.firstName} {customer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={clientError} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-expires">Fecha de vencimiento</Label>
                <Input
                  id="budget-expires"
                  type="date"
                  value={expires}
                  onChange={(event) => setExpires(event.target.value)}
                />
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
                products={products}
                priceMode="sale"
                onChange={handleItemsChange}
              />
              <FieldError message={itemsError} />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">Crear presupuesto</Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}