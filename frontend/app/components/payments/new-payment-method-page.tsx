import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { requireText } from "~/lib/validation";
import {
  addPaymentMethod,
  isPaymentMethodLabelTaken,
  usePaymentMethods,
} from "./payment-methods-store";

type PaymentKind = "manual" | "gateway";

interface PaymentMethodNavigationState {
  backTo?: string;
  [key: string]: unknown;
}

export function NewPaymentMethodPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const methods = usePaymentMethods();
  const navigationState =
    (location.state as PaymentMethodNavigationState | null) ?? {};

  const backTo = navigationState.backTo ?? "/payments";

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PaymentKind>("manual");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = requireText(name, "Nombre");
    const duplicateError =
      !nameError && isPaymentMethodLabelTaken(name)
        ? "Ya existe un medio de pago con ese nombre."
        : null;
    const next = { name: nameError ?? duplicateError };
    setErrors(next);
    if (next.name) return;

    const created = addPaymentMethod({
      label: name,
      gateway: kind === "gateway",
    });
    navigate(backTo, {
      state: { ...navigationState, selectPaymentMethod: created.id },
    });
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      backState={location.state}
      title="Nuevo medio de pago"
      description="Cree un medio de pago para usarlo al registrar pedidos y cobros."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="payment-method-name">Nombre</Label>
              <Input
                id="payment-method-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((prev) => ({ ...prev, name: null }));
                }}
                placeholder="Ej. Transferencia bancaria"
                aria-invalid={!!errors.name}
              />
              <FieldError message={errors.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method-kind">Tipo de cobro</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as PaymentKind)}
              >
                <SelectTrigger id="payment-method-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Cobro manual</SelectItem>
                  <SelectItem value="gateway">
                    Pasarela de pago (simulada)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los medios con pasarela procesan el cobro de forma simulada.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">Crear medio de pago</Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Medios de pago existentes</p>
          <ul className="space-y-2">
            {methods.map((method) => (
              <li
                key={method.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{method.label}</span>
                <Badge variant={method.gateway ? "info" : "secondary"}>
                  {method.gateway ? "Pasarela" : "Manual"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </FormPage>
  );
}
