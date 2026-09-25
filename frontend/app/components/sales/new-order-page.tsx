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

import { validateAddress } from "~/lib/validation";
import type { LineItem, PaymentMethod } from "./sales-types";
import { formatDate } from "./sales-types";
import { addOrder, useOrders } from "./sales-store";
import { LineItemsEditor } from "./line-items-editor";
import { useCustomers } from "../customers/customers-store";
import { useProducts } from "../products/products-store";

export function NewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orders = useOrders();
  const customers = useCustomers();
  const products = useProducts();

  const nextOrderNumber = `PV-${String(orders.length + 1).padStart(3, "0")}`;
  const backTo = "/sales?tab=orders";

  const [client, setClient] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("tarjeta");
  const [items, setItems] = useState<LineItem[]>([]);
  const [total, setTotal] = useState("$0");
  const [addressError, setAddressError] = useState<string | null>(null);
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
    const addressErrorNext = !province.trim()
      ? "La provincia es obligatoria"
      : !locality.trim()
        ? "La localidad es obligatoria"
        : !street.trim()
          ? "La calle es obligatoria"
          : !number.trim()
            ? "La altura es obligatoria"
            : validateAddress({ province, locality, street, number, apartment });
    setAddressError(addressErrorNext);
    if (addressErrorNext) return;
    if (!client) {
      setClientError("Seleccione un cliente");
      return;
    }
    if (items.length === 0) {
      setItemsError("Agregue al menos un producto con cantidad.");
      return;
    }
    const customer = customers.find((item) => item.id === client);
    addOrder({
      number: nextOrderNumber,
      client: customer ? `${customer.firstName} ${customer.lastName}` : "Sin definir",
      clientId: client,
      date: formatDate(new Date()),
      deliveryAddress: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
      items,
      total,
      status: "pendiente",
      payment,
    });
    navigate(`/sales/${nextOrderNumber}`);
  }

  return (
    <FormPage
      backLabel="Volver a Ventas"
      backTo={backTo}
      title="Nuevo pedido de venta"
      description="Cargue el cliente, los productos y el método de pago. Al crear el pedido, el comprobante se envía automáticamente por email al cliente."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-client">Cliente</Label>
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
                      setAddressError(null);
                    }}
                    placeholder="Nombre de la calle"
                    aria-invalid={!!addressError}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-number">Altura</Label>
                  <Input
                    id="order-number"
                    value={number}
                    onChange={(event) => {
                      setNumber(event.target.value);
                      setAddressError(null);
                    }}
                    placeholder="1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-apartment">Departamento</Label>
                  <Input
                    id="order-apartment"
                    value={apartment}
                    onChange={(event) => {
                      setApartment(event.target.value);
                      setAddressError(null);
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
                      setAddressError(null);
                    }}
                    placeholder="Ej. Córdoba"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order-province">Provincia</Label>
                  <Input
                    id="order-province"
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      setAddressError(null);
                    }}
                    placeholder="Ej. Buenos Aires"
                  />
                </div>
              </div>
              <FieldError message={addressError} />
            </div>

            <div className="space-y-2">
              <LineItemsEditor
                products={products}
                priceMode="sale"
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
            <Button type="submit">Crear pedido</Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}