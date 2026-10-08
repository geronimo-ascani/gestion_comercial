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

import type { LineItem, PaymentMethod } from "./sales-types";
import { formatDate } from "./sales-types";
import { addOrder, updateOrder, useOrders } from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { applyOrderStock, applyOrderStockDelta, stockValidationMessage } from "./sales-stock";
import { useCustomers } from "../customers/customers-store";
import { useProducts } from "../products/products-store";
import { createInvoiceFromOrder } from "../payments/payments-store";

export function NewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orders = useOrders();
  const customers = useCustomers();
  const products = useProducts();
  const [searchParams] = useSearchParams();

  const editNumber = searchParams.get("edit");
  const editing = editNumber
    ? (orders.find((order) => order.number === editNumber) ?? null)
    : null;

  const nextOrderNumber = `PV-${String(orders.length + 1).padStart(3, "0")}`;
  const backTo = "/sales?tab=orders";

  const [client, setClient] = useState(editing?.clientId ?? "");
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
  const [items, setItems] = useState<LineItem[]>(editing?.items ?? []);
  const [total, setTotal] = useState(editing?.total ?? "$0");
  const [addressErrors, setAddressErrors] = useState<
    Record<string, string | null>
  >({});
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    const preselected = (location.state as { clienteId?: string } | null)
      ?.clienteId;
    if (preselected) setClient(preselected);
  }, [location.state]);

  useEffect(() => {
    setClient(editing?.clientId ?? "");
    setProvince(editing?.deliveryAddress.province ?? "");
    setLocality(editing?.deliveryAddress.locality ?? "");
    setStreet(editing?.deliveryAddress.street ?? "");
    setNumber(editing?.deliveryAddress.number ?? "");
    setApartment(editing?.deliveryAddress.apartment ?? "");
    setPayment(editing?.payment ?? "tarjeta");
    setItems(editing?.items ?? []);
    setTotal(editing?.total ?? "$0");
    setAddressErrors({});
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
        : !/^[0-9][0-9A-Za-z/-]*$/.test(number.trim())
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
    navigate(`/sales/${nextOrderNumber}`);
  }

  return (
    <FormPage
      backLabel="Volver a Ventas"
      backTo={backTo}
      title={editing ? `Editar pedido ${editing.number}` : "Nuevo pedido de venta"}
      description="Cargue el cliente, los productos y el método de pago. Al crear el pedido, el comprobante se envía automáticamente por email al cliente."
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
                      setNumber(event.target.value);
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
                key={editing ? editing.number : "new"}
                products={products}
                priceMode="sale"
                initialItems={editing?.items}
                onChange={handleItemsChange}
              />
              <FieldError message={itemsError} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-payment">Método de pago</Label>
              <Select
                value={payment}
                onValueChange={(value) => setPayment(value as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">
                    Tarjeta de crédito/débito
                  </SelectItem>
                  <SelectItem value="mercadopago">MercadoPago</SelectItem>
                </SelectContent>
              </Select>
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