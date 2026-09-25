import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
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

import type { LineItem } from "../sales/sales-types";
import { formatDate } from "../sales/sales-types";
import { LineItemsEditor } from "../sales/line-items-editor";
import { useProducts } from "../products/products-store";
import type { PurchaseOrder } from "./purchases-types";
import { addPurchaseOrder, useProviders, usePurchaseOrders } from "./purchases-store";

export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const providers = useProviders();
  const orders = usePurchaseOrders();
  const products = useProducts();

  const nextOrderNumber = `OC-${String(orders.length + 1).padStart(3, "0")}`;
  const backTo = "/purchases?tab=orders";

  const [provider, setProvider] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [total, setTotal] = useState("$0");
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  useEffect(() => {
    const preselected = (location.state as { providerId?: string } | null)
      ?.providerId;
    if (preselected) setProvider(preselected);
  }, [location.state]);

  function handleItemsChange(nextItems: LineItem[], nextTotal: string) {
    setItems(nextItems);
    setTotal(nextTotal);
    setItemsError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) {
      setProviderError("Seleccione un proveedor");
      return;
    }
    if (items.length === 0) {
      setItemsError("Agregue al menos un producto con cantidad.");
      return;
    }
    const purchaseOrder: PurchaseOrder = {
      number: nextOrderNumber,
      provider: provider,
      date: formatDate(new Date()),
      items,
      total,
      status: "pendiente",
    };
    addPurchaseOrder(purchaseOrder);
    navigate(backTo);
  }

  return (
    <FormPage
      backLabel="Volver a Compras"
      backTo={backTo}
      title="Nueva orden de compra"
      description="Seleccione el proveedor, los productos y las cantidades. Si el proveedor no existe, puede cargarlo desde aquí."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-provider">Proveedor</Label>
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay proveedores cargados. Cree uno para poder generar la
                    orden de compra.
                  </p>
                ) : (
                  <Select
                    value={provider || undefined}
                    onValueChange={(value) => {
                      setProvider(value ?? "");
                      setProviderError(null);
                    }}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={!!providerError}
                    >
                      <SelectValue placeholder="Seleccionar proveedor">
                        {(selected) => {
                          if (!selected) return "Seleccionar proveedor";
                          const picked = providers.find(
                            (item) => item.id === selected
                          );
                          return picked ? picked.name : selected;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          label={item.name}
                        >
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FieldError message={providerError} />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() =>
                    navigate("/purchases/new-provider", {
                      state: { backTo: "/purchases/new-order" },
                    })
                  }
                >
                  <Plus />
                  Nuevo proveedor
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                products={products}
                priceMode="purchase"
                onChange={handleItemsChange}
              />
              <FieldError message={itemsError} />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">Crear orden</Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}