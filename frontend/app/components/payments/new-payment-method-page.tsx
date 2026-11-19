import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
  loadPaymentMethods,
  usePaymentMethods,
  usePaymentMethodsLoading,
} from "./payment-methods-store";

const TIPOS_COBRO = [
  { value: "contado", label: "Contado" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "billetera", label: "Billetera virtual" },
  { value: "cheque", label: "Cheque" },
  { value: "cuenta_corriente", label: "Cuenta corriente" },
] as const;

const TIPOS_COBRO_ITEMS = Object.fromEntries(
  TIPOS_COBRO.map((tipo) => [tipo.value, tipo.label])
);

interface PaymentMethodNavigationState {
  backTo?: string;
  [key: string]: unknown;
}

export function NewPaymentMethodPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const methods = usePaymentMethods();
  const loading = usePaymentMethodsLoading();
  const navigationState =
    (location.state as PaymentMethodNavigationState | null) ?? {};

  const backTo = navigationState.backTo ?? "/payments";

  const [name, setName] = useState("");
  const [tipoCobro, setTipoCobro] = useState<string>("contado");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadPaymentMethods().catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = requireText(name, "Nombre");
    const duplicateError =
      !nameError && isPaymentMethodLabelTaken(name)
        ? "Ya existe un medio de pago con ese nombre."
        : null;
    const next = { name: nameError ?? duplicateError };
    setErrors(next);
    if (next.name) return;

    setSubmitting(true);
    try {
      const created = await addPaymentMethod({
        label: name,
        tipoCobro,
      });
      navigate(backTo, {
        state: { ...navigationState, selectPaymentMethod: created.id },
      });
    } catch (error) {
      setErrors({
        name:
          error instanceof Error
            ? error.message
            : "No se pudo crear el medio de pago.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      backState={location.state}
      title="Nuevo medio de pago"
      description="Cree un medio de pago para usarlo al registrar cobros."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="payment-method-name">Nombre</Label>
              <Input
                id="payment-method-name"
                value={name}
                disabled={submitting}
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
                value={tipoCobro}
                items={TIPOS_COBRO_ITEMS}
                onValueChange={(value) => setTipoCobro(value ?? "contado")}
                disabled={submitting}
              >
                <SelectTrigger id="payment-method-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_COBRO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El tipo de cobro clasifica el medio en los reportes.
              </p>
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
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Crear medio de pago
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Medios de pago existentes</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay medios de pago registrados.
            </p>
          ) : (
            <ul className="space-y-2">
              {methods.map((method) => (
                <li
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{method.label}</span>
                  <Badge variant="secondary">{method.tipoCobro}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </FormPage>
  );
}
