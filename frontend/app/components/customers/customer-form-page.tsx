import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  requireText,
  validateAddress,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";

import { useCurrentUser } from "../auth/session-store";
import { getCustomer, listTaxConditions, type CondicionIVA } from "./customers-api";
import { addCustomer, updateCustomer } from "./customers-store";
import type { Customer } from "./customers-types";

export function CustomerFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const editId = searchParams.get("edit");
  const backTo =
    (location.state as { backTo?: string } | null)?.backTo ?? "/customers";

  const [conditions, setConditions] = useState<CondicionIVA[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxConditionId, setTaxConditionId] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSubmitError(null);
    const customerPromise = editId ? getCustomer(editId) : Promise.resolve(null);
    Promise.all([listTaxConditions(), customerPromise])
      .then(([taxConditions, customer]) => {
        if (cancelled) return;
        setConditions(taxConditions);
        setTaxConditionId(
          customer?.taxConditionId ?? taxConditions[0]?.id_condicion_iva ?? ""
        );
        if (customer) {
          setFirstName(customer.firstName);
          setLastName(customer.lastName);
          setDocument(customer.document);
          setPhone(customer.phone);
          setEmail(customer.email);
          setProvince(customer.address.province);
          setLocality(customer.address.locality);
          setStreet(customer.address.street);
          setNumber(customer.address.number);
          setApartment(customer.address.apartment);
          setPostalCode(customer.address.postalCode ?? "");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error ? error.message : "No se pudieron cargar los datos."
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
      firstName: requireText(firstName, "Nombre"),
      lastName: requireText(lastName, "Apellido"),
      document: document.trim()
        ? validateDocument(document)
        : requireText(document, "DNI/CUIT"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      phone: phone.trim()
        ? validatePhone(phone)
        : requireText(phone, "Teléfono"),
      taxCondition: taxConditionId ? null : "Seleccione una condición de IVA",
      postalCode: requireText(postalCode, "Código postal"),
      ...validateAddress(
        { province, locality, street, number, apartment },
        { required: true }
      ),
    };
    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some(Boolean)) return;

    const customer: Customer = {
      id: editId ?? "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      document: document.trim(),
      phone: phone.trim(),
      email: email.trim(),
      taxConditionId,
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
        postalCode: postalCode.trim(),
      },
    };

    setSaving(true);
    try {
      const saved = editId
        ? await updateCustomer(editId, customer)
        : await addCustomer(customer);
      navigate(backTo, { state: { clienteId: saved.id } });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar el cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  if (currentUser?.role !== "administrador") {
    return <Navigate to="/customers" replace />;
  }

  if (loading) {
    return (
      <FormPage backLabel="Volver" backTo={backTo} title="Cargando cliente">
        <p role="status" className="text-sm text-muted-foreground">
          Cargando datos…
        </p>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      title={editId ? "Editar cliente" : "Nuevo cliente"}
      description="Complete los datos del cliente. El saldo se gestiona desde las operaciones comerciales."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-first-name">Nombre</Label>
                <Input id="customer-first-name" value={firstName} onChange={(event) => setField("firstName", event.target.value, setFirstName)} aria-invalid={!!errors.firstName} />
                <FieldError message={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-last-name">Apellido</Label>
                <Input id="customer-last-name" value={lastName} onChange={(event) => setField("lastName", event.target.value, setLastName)} aria-invalid={!!errors.lastName} />
                <FieldError message={errors.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-document">DNI / CUIT</Label>
                <Input id="customer-document" value={document} onChange={(event) => setField("document", event.target.value, setDocument)} aria-invalid={!!errors.document} />
                <FieldError message={errors.document} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Teléfono</Label>
                <Input id="customer-phone" value={phone} onChange={(event) => setField("phone", event.target.value, setPhone)} aria-invalid={!!errors.phone} />
                <FieldError message={errors.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Correo electrónico</Label>
                <Input id="customer-email" type="email" value={email} onChange={(event) => setField("email", event.target.value, setEmail)} aria-invalid={!!errors.email} />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-tax-condition">Condición de IVA</Label>
                <Select value={taxConditionId} onValueChange={(value) => setField("taxCondition", value ?? "", setTaxConditionId)}>
                  <SelectTrigger id="customer-tax-condition" className="w-full" aria-invalid={!!errors.taxCondition}>
                    <SelectValue>
                      {(value) => conditions.find((item) => item.id_condicion_iva === value)?.descripcion ?? "Seleccionar condición"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((condition) => (
                      <SelectItem key={condition.id_condicion_iva} value={condition.id_condicion_iva}>
                        {condition.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.taxCondition} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dirección</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customer-street">Calle</Label>
                  <Input id="customer-street" value={street} onChange={(event) => setField("street", event.target.value, setStreet)} aria-invalid={!!errors.street} />
                  <FieldError message={errors.street} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-number">Altura</Label>
                  <Input id="customer-number" value={number} onChange={(event) => setField("number", event.target.value.replace(/\D/g, ""), setNumber)} aria-invalid={!!errors.number} />
                  <FieldError message={errors.number} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-apartment">Departamento</Label>
                  <Input id="customer-apartment" value={apartment} onChange={(event) => setField("apartment", event.target.value, setApartment)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-locality">Localidad</Label>
                  <Input id="customer-locality" value={locality} onChange={(event) => setField("locality", event.target.value, setLocality)} aria-invalid={!!errors.locality} />
                  <FieldError message={errors.locality} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-province">Provincia</Label>
                  <Input id="customer-province" value={province} onChange={(event) => setField("province", event.target.value, setProvince)} aria-invalid={!!errors.province} />
                  <FieldError message={errors.province} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-postal-code">Código postal</Label>
                  <Input id="customer-postal-code" value={postalCode} onChange={(event) => setField("postalCode", event.target.value, setPostalCode)} aria-invalid={!!errors.postalCode} />
                  <FieldError message={errors.postalCode} />
                </div>
              </div>
            </div>
            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear cliente"}</Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}
