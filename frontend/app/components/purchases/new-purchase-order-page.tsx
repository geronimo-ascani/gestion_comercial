import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import { Combobox } from "~/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { LineItem } from "../sales/sales-types";
import { LineItemsEditor } from "../sales/line-items-editor";
import { useProducts } from "../products/products-store";
import { useCurrentUser } from "../auth/session-store";
import {
  savePurchaseOrder,
  refreshProviders,
  useProviders,
} from "./purchases-store";
import {
  createPurchaseOrder,
  listPurchasePaymentMethods,
  type PurchasePaymentMethod,
} from "./purchases-api";
import { parseNumberInput } from "~/lib/currency";

interface PurchaseOrderDraft {
  providerId: string;
  paymentMethodId: string;
  items: LineItem[];
}

interface PurchaseOrderLocationState {
  providerId?: string;
  purchaseDraft?: PurchaseOrderDraft;
}

export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as PurchaseOrderLocationState | null;
  const providers = useProviders();
  const currentUser = useCurrentUser();
  const canCreateProviders = ["administrador", "abastecimiento"].includes(
    currentUser?.role ?? ""
  );
  const products = useProducts();

  const backTo = "/purchases?tab=orders";

  const [provider, setProvider] = useState(
    navigationState?.purchaseDraft?.providerId ?? ""
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    navigationState?.purchaseDraft?.paymentMethodId ?? ""
  );
  const [paymentMethods, setPaymentMethods] = useState<PurchasePaymentMethod[]>([]);
  const [items, setItems] = useState<LineItem[]>(
    navigationState?.purchaseDraft?.items ?? []
  );
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refreshProviders().catch((error: unknown) => {
      setProviderError(
        error instanceof Error ? error.message : "No se pudieron cargar los proveedores."
      );
    });
    void listPurchasePaymentMethods()
      .then(setPaymentMethods)
      .catch((error: unknown) => {
        setPaymentMethodError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los medios de pago."
        );
      });
  }, []);

  useEffect(() => {
    const preselected = navigationState?.providerId;
    if (preselected) setProvider(preselected);
  }, [navigationState?.providerId]);

  function handleItemsChange(nextItems: LineItem[]) {
    setItems(nextItems);
    setItemsError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) {
      setProviderError("Seleccione un proveedor");
      return;
    }
    if (!paymentMethodId) {
      setPaymentMethodError("Seleccione un medio de pago");
      return;
    }
    if (items.length === 0) {
      setItemsError("Agregue al menos un producto con cantidad.");
      return;
    }
    if (
      items.some(
        (item) => !item.sku || parseNumberInput(item.unitPrice) <= 0
      )
    ) {
      setItemsError("Cada producto debe tener un código y un precio mayor que cero.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await createPurchaseOrder({
        id_proveedor: provider,
        id_medio_pago: paymentMethodId,
        items: items.map((item) => ({
          id_producto: item.sku ?? "",
          cantidad: item.qty,
          precio_unitario: parseNumberInput(item.unitPrice),
        })),
      });
      savePurchaseOrder(order);
      navigate(backTo);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo crear la orden."
      );
    } finally {
      setSubmitting(false);
    }
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
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Combobox
                      id="order-provider"
                      value={provider}
                      onValueChange={(value) => {
                        setProvider(value);
                        setProviderError(null);
                      }}
                      options={providers.map((item) => ({
                        value: item.id,
                        label: item.name,
                        description: item.cuit || undefined,
                        keywords: [item.cuit, item.email, item.phone].filter(
                          (item): item is string => Boolean(item)
                        ),
                      }))}
                      placeholder="Seleccionar proveedor"
                      searchPlaceholder="Buscar proveedor por nombre o CUIT..."
                      notFoundText="No se encontraron proveedores"
                      emptyText="No hay proveedores cargados"
                      ariaInvalid={!!providerError}
                    />
                  </div>
                  {canCreateProviders && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11"
                      aria-label="Agregar proveedor"
                      title="Agregar proveedor"
                      onClick={() =>
                        navigate("/purchases/new-provider", {
                          state: {
                            backTo: "/purchases/new-order",
                            purchaseDraft: {
                              providerId: provider,
                              paymentMethodId,
                              items,
                            } satisfies PurchaseOrderDraft,
                          },
                        })
                      }
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <FieldError message={providerError} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-payment-method">Medio de pago</Label>
                <Select
                  value={paymentMethodId}
                  onValueChange={(value) => {
                    setPaymentMethodId(value ?? "");
                    setPaymentMethodError(null);
                  }}
                >
                  <SelectTrigger
                    id="order-payment-method"
                    className="w-full"
                    aria-invalid={!!paymentMethodError}
                  >
                    <SelectValue>
                      {(value) =>
                        paymentMethods.find(
                          (method) => method.id_medio_pago === value
                        )?.medio_pago ?? "Seleccionar medio de pago"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem
                        key={method.id_medio_pago}
                        value={method.id_medio_pago}
                      >
                        {method.medio_pago}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={paymentMethodError} />
              </div>
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                products={products}
                priceMode="purchase"
                initialItems={navigationState?.purchaseDraft?.items}
                onChange={handleItemsChange}
              />
              <FieldError message={itemsError} />
            </div>
            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Crear orden"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}