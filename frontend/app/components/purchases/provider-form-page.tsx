import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  requireText,
  validateAddress,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";

import { useCurrentUser } from "../auth/session-store";
import { getProvider } from "./providers-api";
import {
  addProvider,
  updateProvider,
} from "./purchases-store";
import type { LineItem } from "../sales/sales-types";
import type { Provider } from "./purchases-types";

export function ProviderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const editId = searchParams.get("edit");
  const canCreate = ["administrador", "abastecimiento"].includes(
    currentUser?.role ?? ""
  );
  const canEdit = currentUser?.role === "administrador";
  const navigationState = location.state as {
    backTo?: string;
    purchaseDraft?: {
      providerId: string;
      paymentMethodId: string;
      items: LineItem[];
    };
  } | null;
  const backTo = navigationState?.backTo ?? "/providers";
  const backState = navigationState?.purchaseDraft
    ? { purchaseDraft: navigationState.purchaseDraft }
    : undefined;

  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true);
    getProvider(editId)
      .then((provider) => {
        if (cancelled) return;
        setName(provider.name);
        setCuit(provider.cuit);
        setPhone(provider.phone);
        setEmail(provider.email);
        setProvince(provider.address.province);
        setLocality(provider.address.locality);
        setStreet(provider.address.street);
        setNumber(provider.address.number);
        setApartment(provider.address.apartment);
        setPostalCode(provider.address.postalCode ?? "");
        setBank(provider.bank);
        setAccount(provider.account);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error ? error.message : "No se pudo cargar el proveedor."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void
  ) {
    setter(value);
    setErrors((previous) => ({ ...previous, [field]: null }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Razón social"),
      cuit: cuit.trim()
        ? validateDocument(cuit)
        : requireText(cuit, "CUIT"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      phone: phone.trim()
        ? validatePhone(phone)
        : requireText(phone, "Teléfono"),
      bank: requireText(bank, "Banco"),
      account: requireText(account, "Número de cuenta"),
      postalCode: requireText(postalCode, "Código postal"),
      ...validateAddress(
        { province, locality, street, number, apartment },
        { required: true }
      ),
    };
    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some(Boolean)) return;

    const provider: Provider = {
      id: editId ?? "",
      name: name.trim(),
      cuit: cuit.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
        postalCode: postalCode.trim(),
      },
      bank: bank.trim(),
      account: account.trim(),
    };

    setSaving(true);
    try {
      const saved = editId
        ? await updateProvider(editId, provider)
        : await addProvider(provider);
      navigate(backTo, {
        state: { ...backState, providerId: saved.id },
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar el proveedor."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canCreate || (editId !== null && !canEdit)) {
    return <Navigate to="/providers" replace />;
  }

  if (loading) {
    return (
      <FormPage
        backLabel="Volver"
        backTo={backTo}
        backState={backState}
        title="Cargando proveedor"
      >
        <p role="status" className="text-sm text-muted-foreground">Cargando datos…</p>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      backState={backState}
      title={editId ? "Editar proveedor" : "Nuevo proveedor"}
      description="Complete los datos del proveedor. El saldo se gestiona desde las operaciones comerciales."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider-name">Nombre / Razón social</Label>
                <Input id="provider-name" value={name} onChange={(event) => setField("name", event.target.value, setName)} aria-invalid={!!errors.name} />
                <FieldError message={errors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-cuit">CUIT</Label>
                <Input id="provider-cuit" value={cuit} onChange={(event) => setField("cuit", event.target.value, setCuit)} aria-invalid={!!errors.cuit} />
                <FieldError message={errors.cuit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-phone">Teléfono</Label>
                <Input id="provider-phone" value={phone} onChange={(event) => setField("phone", event.target.value, setPhone)} aria-invalid={!!errors.phone} />
                <FieldError message={errors.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-email">Correo electrónico</Label>
                <Input id="provider-email" type="email" value={email} onChange={(event) => setField("email", event.target.value, setEmail)} aria-invalid={!!errors.email} />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-bank">Banco</Label>
                <Input id="provider-bank" value={bank} onChange={(event) => setField("bank", event.target.value, setBank)} aria-invalid={!!errors.bank} />
                <FieldError message={errors.bank} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-account">Número de cuenta</Label>
                <Input id="provider-account" value={account} onChange={(event) => setField("account", event.target.value, setAccount)} aria-invalid={!!errors.account} />
                <FieldError message={errors.account} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dirección</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="provider-street">Calle</Label>
                  <Input id="provider-street" value={street} onChange={(event) => setField("street", event.target.value, setStreet)} aria-invalid={!!errors.street} />
                  <FieldError message={errors.street} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-number">Altura</Label>
                  <Input id="provider-number" value={number} onChange={(event) => setField("number", event.target.value.replace(/\D/g, ""), setNumber)} aria-invalid={!!errors.number} />
                  <FieldError message={errors.number} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-apartment">Departamento</Label>
                  <Input id="provider-apartment" value={apartment} onChange={(event) => setField("apartment", event.target.value, setApartment)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-locality">Localidad</Label>
                  <Input id="provider-locality" value={locality} onChange={(event) => setField("locality", event.target.value, setLocality)} aria-invalid={!!errors.locality} />
                  <FieldError message={errors.locality} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-province">Provincia</Label>
                  <Input id="provider-province" value={province} onChange={(event) => setField("province", event.target.value, setProvince)} aria-invalid={!!errors.province} />
                  <FieldError message={errors.province} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-postal-code">Código postal</Label>
                  <Input id="provider-postal-code" value={postalCode} onChange={(event) => setField("postalCode", event.target.value, setPostalCode)} aria-invalid={!!errors.postalCode} />
                  <FieldError message={errors.postalCode} />
                </div>
              </div>
            </div>
            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(backTo, { state: backState })}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear proveedor"}</Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}
