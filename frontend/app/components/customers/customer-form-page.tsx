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
import { parseNumberInput } from "~/lib/currency";
import { addCustomer, updateCustomer, useCustomers } from "./customers-store";
import type { Customer } from "./customers-types";

export function CustomerFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const customers = useCustomers();
  const editId = searchParams.get("edit");
  const editing = editId
    ? (customers.find((customer) => customer.id === editId) ?? null)
    : null;
  const backTo =
    (location.state as { backTo?: string } | null)?.backTo ?? "/customers";

  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [document, setDocument] = useState(editing?.document ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [province, setProvince] = useState(editing?.address?.province ?? "");
  const [locality, setLocality] = useState(editing?.address?.locality ?? "");
  const [street, setStreet] = useState(editing?.address?.street ?? "");
  const [number, setNumber] = useState(editing?.address?.number ?? "");
  const [apartment, setApartment] = useState(editing?.address?.apartment ?? "");
  const [balance, setBalance] = useState(
    editing && typeof editing.balance === "number" ? String(editing.balance) : ""
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      phone: phone.trim() ? validatePhone(phone) : requireText(phone, "Teléfono"),
      balance: balance.trim()
        ? Number.isFinite(parseNumberInput(balance))
          ? null
          : "Saldo inválido"
        : null,
      ...validateAddress(
        { province, locality, street, number, apartment },
        { required: true }
      ),
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;
    const customer: Customer = {
      id: editing?.id ?? crypto.randomUUID(),
      firstName: firstName.trim() || "Sin definir",
      lastName: lastName.trim(),
      document: document.trim(),
      phone: phone.trim(),
      email: email.trim(),
      balance: balance.trim() ? parseNumberInput(balance) : 0,
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
    };
    if (editing) {
      updateCustomer(customer.id, customer);
    } else {
      addCustomer(customer);
    }
    navigate(backTo, { state: { clienteId: customer.id } });
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      title={editing ? "Editar cliente" : "Nuevo cliente"}
      description="Complete los datos del cliente. Nombre, apellido, DNI/CUIT, correo electrónico, teléfono y dirección son obligatorios."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-first-name">Nombre</Label>
                <Input
                  id="customer-first-name"
                  value={firstName}
                  onChange={(event) =>
                    setField("firstName", event.target.value, setFirstName)
                  }
                  placeholder="Ej. Juan"
                  aria-invalid={!!errors.firstName}
                />
                <FieldError message={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-last-name">Apellido</Label>
                <Input
                  id="customer-last-name"
                  value={lastName}
                  onChange={(event) =>
                    setField("lastName", event.target.value, setLastName)
                  }
                  placeholder="Ej. Pérez"
                  aria-invalid={!!errors.lastName}
                />
                <FieldError message={errors.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-document">DNI / CUIT</Label>
                <Input
                  id="customer-document"
                  value={document}
                  onChange={(event) =>
                    setField("document", event.target.value, setDocument)
                  }
                  placeholder="DNI 33.251.234 / CUIT 20-..."
                  aria-invalid={!!errors.document}
                />
                <FieldError message={errors.document} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Teléfono</Label>
                <Input
                  id="customer-phone"
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
                <Label htmlFor="customer-email">Correo electrónico</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setField("email", event.target.value, setEmail)
                  }
                  placeholder="cliente@mail.com"
                  aria-invalid={!!errors.email}
                />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-balance">Saldo en cuenta corriente</Label>
                <Input
                  id="customer-balance"
                  inputMode="decimal"
                  value={balance}
                  onChange={(event) =>
                    setField("balance", event.target.value, setBalance)
                  }
                  placeholder="0"
                  aria-invalid={!!errors.balance}
                />
                <FieldError message={errors.balance} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Dirección</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="customer-street">Calle</Label>
                    <Input
                      id="customer-street"
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
                    <Label htmlFor="customer-number">Altura</Label>
                    <Input
                      id="customer-number"
                      value={number}
                      onChange={(event) =>
                        setField(
                          "number",
                          event.target.value.replace(/\D/g, ""),
                          setNumber
                        )
                      }
                      placeholder="1234"
                      aria-invalid={!!errors.number}
                    />
                    <FieldError message={errors.number} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-apartment">Departamento</Label>
                    <Input
                      id="customer-apartment"
                      value={apartment}
                      onChange={(event) =>
                        setField("apartment", event.target.value, setApartment)
                      }
                      placeholder="Ej. 3º B"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-locality">Localidad</Label>
                    <Input
                      id="customer-locality"
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
                    <Label htmlFor="customer-province">Provincia</Label>
                    <Input
                      id="customer-province"
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
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editing ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}