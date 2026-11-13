import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { FieldError } from "~/components/ui/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { invalidateProducts } from "../products/products-store";
import { convertBudget } from "./sales-store";
import type { Budget } from "./sales-types";

interface DeliveryAddress {
  province: string;
  locality: string;
  street: string;
  number: string;
  postalCode: string;
  apartment: string;
}

const EMPTY_ADDRESS: DeliveryAddress = {
  province: "",
  locality: "",
  street: "",
  number: "",
  postalCode: "",
  apartment: "",
};

export function BudgetConversionDialog({ budget }: { budget: Budget }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateAddress(field: keyof DeliveryAddress, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setRequestError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!address.province.trim()) nextErrors.province = "Ingrese la provincia.";
    if (!address.locality.trim()) nextErrors.locality = "Ingrese la localidad.";
    if (!address.street.trim()) nextErrors.street = "Ingrese la calle.";
    if (!address.number.trim() || !/^\d+$/.test(address.number.trim())) {
      nextErrors.number = "Ingrese una altura numérica.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setRequestError(null);
    try {
      const order = await convertBudget(budget.number, {
        entrega_provincia: address.province.trim(),
        entrega_localidad: address.locality.trim(),
        entrega_calle: address.street.trim(),
        entrega_altura: address.number.trim(),
        entrega_cp: address.postalCode.trim(),
        entrega_depto: address.apartment.trim(),
      });
      invalidateProducts();
      setOpen(false);
      navigate(`/sales/${encodeURIComponent(order.number)}`);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "No se pudo convertir el presupuesto.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setAddress(EMPTY_ADDRESS);
          setErrors({});
          setRequestError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Convertir
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convertir {budget.number} en pedido</DialogTitle>
            <DialogDescription>
              Se conservarán los precios cotizados y se reservará el stock. La
              conversión no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {requestError && (
            <p
              className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
              role="alert"
            >
              {requestError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="conversion-province">Provincia</Label>
              <Input
                id="conversion-province"
                value={address.province}
                onChange={(event) =>
                  updateAddress("province", event.target.value)
                }
                aria-invalid={Boolean(errors.province)}
              />
              <FieldError message={errors.province} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-locality">Localidad</Label>
              <Input
                id="conversion-locality"
                value={address.locality}
                onChange={(event) =>
                  updateAddress("locality", event.target.value)
                }
                aria-invalid={Boolean(errors.locality)}
              />
              <FieldError message={errors.locality} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-street">Calle</Label>
              <Input
                id="conversion-street"
                value={address.street}
                onChange={(event) =>
                  updateAddress("street", event.target.value)
                }
                aria-invalid={Boolean(errors.street)}
              />
              <FieldError message={errors.street} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-number">Altura</Label>
              <Input
                id="conversion-number"
                inputMode="numeric"
                value={address.number}
                onChange={(event) =>
                  updateAddress("number", event.target.value)
                }
                aria-invalid={Boolean(errors.number)}
              />
              <FieldError message={errors.number} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-postal-code">Código postal</Label>
              <Input
                id="conversion-postal-code"
                value={address.postalCode}
                onChange={(event) =>
                  updateAddress("postalCode", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conversion-apartment">Piso / departamento</Label>
              <Input
                id="conversion-apartment"
                value={address.apartment}
                onChange={(event) =>
                  updateAddress("apartment", event.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Convirtiendo…" : "Crear pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
