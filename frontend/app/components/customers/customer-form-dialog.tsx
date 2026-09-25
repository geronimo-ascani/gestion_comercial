import { useEffect, useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";

import {
  requireText,
  validateAddress,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";
import type { Customer } from "./customers-types";

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSaved: (customer: Customer) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (open) {
      setFirstName(customer?.firstName ?? "");
      setLastName(customer?.lastName ?? "");
      setDocument(customer?.document ?? "");
      setPhone(customer?.phone ?? "");
      setEmail(customer?.email ?? "");
      setProvince(customer?.address?.province ?? "");
      setLocality(customer?.address?.locality ?? "");
      setStreet(customer?.address?.street ?? "");
      setNumber(customer?.address?.number ?? "");
      setApartment(customer?.address?.apartment ?? "");
      setErrors({});
    }
  }, [open, customer]);

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
      address: validateAddress({ province, locality, street, number, apartment }),
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;
    onSaved({
      id: customer?.id ?? crypto.randomUUID(),
      firstName: firstName.trim() || "Sin definir",
      lastName: lastName.trim(),
      document: document.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {customer ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del cliente. Nombre, apellido, DNI/CUIT, correo
            electrónico y teléfono son obligatorios.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="customer-street">Calle</Label>
                  <Input
                    id="customer-street"
                    value={street}
                    onChange={(event) =>
                      setField("address", event.target.value, setStreet)
                    }
                    placeholder="Nombre de la calle"
                    aria-invalid={!!errors.address}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-number">Altura</Label>
                  <Input
                    id="customer-number"
                    value={number}
                    onChange={(event) =>
                      setField("address", event.target.value, setNumber)
                    }
                    placeholder="1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-apartment">Departamento</Label>
                  <Input
                    id="customer-apartment"
                    value={apartment}
                    onChange={(event) =>
                      setField("address", event.target.value, setApartment)
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
                      setField("address", event.target.value, setLocality)
                    }
                    placeholder="Ej. Córdoba"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-province">Provincia</Label>
                  <Input
                    id="customer-province"
                    value={province}
                    onChange={(event) =>
                      setField("address", event.target.value, setProvince)
                    }
                    placeholder="Ej. Buenos Aires"
                  />
                </div>
              </div>
              <FieldError message={errors.address} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">
              {customer ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}