import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";

import {
  requireText,
  validateAddress,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";
import { addProvider, updateProvider, useProviders } from "./purchases-store";
import type { Provider } from "./purchases-types";

export function ProviderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const providers = useProviders();
  const editId = searchParams.get("edit");
  const editing = editId
    ? (providers.find((provider) => provider.id === editId) ?? null)
    : null;
  const backTo =
    (location.state as { backTo?: string } | null)?.backTo ??
    "/purchases?tab=providers";

  const [name, setName] = useState(editing?.name ?? "");
  const [cuit, setCuit] = useState(editing?.cuit ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [province, setProvince] = useState(editing?.address?.province ?? "");
  const [locality, setLocality] = useState(editing?.address?.locality ?? "");
  const [street, setStreet] = useState(editing?.address?.street ?? "");
  const [number, setNumber] = useState(editing?.address?.number ?? "");
  const [apartment, setApartment] = useState(editing?.address?.apartment ?? "");
  const [bank, setBank] = useState(editing?.bank ?? "");
  const [account, setAccount] = useState(editing?.account ?? "");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre / Razón social"),
      cuit: cuit.trim()
        ? validateDocument(cuit)
        : requireText(cuit, "CUIT"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      phone: phone.trim() ? validatePhone(phone) : requireText(phone, "Teléfono"),
      ...validateAddress({ province, locality, street, number, apartment }, { required: true }),
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;
    const provider: Provider = {
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim() || "Sin definir",
      cuit: cuit.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
      bank: bank.trim(),
      account: account.trim(),
    };
    if (editing) {
      updateProvider(provider.id, provider);
    } else {
      addProvider(provider);
    }
    navigate(backTo, { state: { providerId: provider.id } });
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      title={editing ? "Editar proveedor" : "Nuevo proveedor"}
      description="Complete los datos del proveedor. Nombre / Razón social, CUIT, teléfono, correo electrónico y dirección son obligatorios."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider-name">Nombre / Razón social</Label>
                <Input
                  id="provider-name"
                  value={name}
                  onChange={(event) =>
                    setField("name", event.target.value, setName)
                  }
                  placeholder="Ej. Distribuidora San Juan"
                  aria-invalid={!!errors.name}
                />
                <FieldError message={errors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-cuit">CUIT</Label>
                <Input
                  id="provider-cuit"
                  value={cuit}
                  onChange={(event) =>
                    setField("cuit", event.target.value, setCuit)
                  }
                  placeholder="20-12345678-9"
                  aria-invalid={!!errors.cuit}
                />
                <FieldError message={errors.cuit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-phone">Teléfono</Label>
                <Input
                  id="provider-phone"
                  value={phone}
                  onChange={(event) =>
                    setField("phone", event.target.value, setPhone)
                  }
                  placeholder="+54 11 5555-0000"
                  aria-invalid={!!errors.phone}
                />
                <FieldError message={errors.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-email">Correo electrónico</Label>
                <Input
                  id="provider-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setField("email", event.target.value, setEmail)
                  }
                  placeholder="ventas@proveedor.com.ar"
                  aria-invalid={!!errors.email}
                />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Dirección</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="provider-street">Calle</Label>
                    <Input
                      id="provider-street"
                      value={street}
                      onChange={(event) =>
                        setField("street", event.target.value, setStreet)
                      }
                      placeholder="Nombre de la calle"
                      aria-invalid={!!errors.street}
                    />
                    <FieldError message={errors.street} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-number">Altura</Label>
                    <Input
                      id="provider-number"
                      value={number}
                      onChange={(event) =>
                        setField("number", event.target.value, setNumber)
                      }
                      placeholder="1234"
                      aria-invalid={!!errors.number}
                    />
                    <FieldError message={errors.number} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-apartment">Departamento</Label>
                    <Input
                      id="provider-apartment"
                      value={apartment}
                      onChange={(event) =>
                        setField("apartment", event.target.value, setApartment)
                      }
                      placeholder="Ej. 3º B"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-locality">Localidad</Label>
                    <Input
                      id="provider-locality"
                      value={locality}
                      onChange={(event) =>
                        setField("locality", event.target.value, setLocality)
                      }
                      placeholder="Ej. Córdoba"
                      aria-invalid={!!errors.locality}
                    />
                    <FieldError message={errors.locality} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-province">Provincia</Label>
                    <Input
                      id="provider-province"
                      value={province}
                      onChange={(event) =>
                        setField("province", event.target.value, setProvince)
                      }
                      placeholder="Ej. Buenos Aires"
                      aria-invalid={!!errors.province}
                    />
                    <FieldError message={errors.province} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-bank">Banco</Label>
                <Input
                  id="provider-bank"
                  value={bank}
                  onChange={(event) => setBank(event.target.value)}
                  placeholder="Ej. Banco Galicia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-account">Número de cuenta</Label>
                <Input
                  id="provider-account"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="CBU / número de cuenta"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editing ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}