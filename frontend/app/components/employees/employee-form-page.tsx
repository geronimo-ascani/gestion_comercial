import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

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

import { formatInputDate } from "../sales/sales-types";
import {
  requireText,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";
import {
  employeeRoleLabels,
  type Employee,
  type EmployeeRole,
} from "./employees-types";
import { addEmployee, updateEmployee, useEmployees } from "./employees-store";

export function EmployeeFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employees = useEmployees();
  const editId = searchParams.get("edit");
  const editing = editId
    ? (employees.find((employee) => employee.id === editId) ?? null)
    : null;
  const backTo = "/employees";

  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [cuil, setCuil] = useState(editing?.cuil ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [hireDate, setHireDate] = useState(editing?.hireDate ?? "");
  const [role, setRole] = useState(editing?.role ?? "");
  const [password, setPassword] = useState(editing?.password ?? "");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      cuil: cuil.trim()
        ? validateDocument(cuil)
        : requireText(cuil, "DNI/CUIL"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      phone: phone.trim() ? validatePhone(phone) : requireText(phone, "Teléfono"),
      hireDate: requireText(hireDate, "Fecha de ingreso"),
      password:
        password.trim().length === 0
          ? null
          : password.trim().length < 6
            ? "Debe tener al menos 6 caracteres"
            : null,
      confirmPassword:
        confirmPassword.trim().length === 0
          ? null
          : confirmPassword.trim() !== password.trim()
            ? "Las contraseñas no coinciden"
            : null,
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;
    const employee: Employee = {
      id: editing?.id ?? crypto.randomUUID(),
      firstName: firstName.trim() || "Sin definir",
      lastName: lastName.trim(),
      cuil: cuil.trim(),
      phone: phone.trim(),
      email: email.trim(),
      hireDate: editing?.hireDate ?? formatInputDate(hireDate),
      role: (role as EmployeeRole) || "ventas",
      password: password.trim() || undefined,
    };
    if (editing) {
      updateEmployee(employee.id, employee);
    } else {
      addEmployee(employee);
    }
    navigate(backTo);
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      title={editing ? "Editar empleado" : "Nuevo empleado"}
      description="Complete los datos del empleado. Nombre, apellido, DNI/CUIL, teléfono y fecha de ingreso son obligatorios."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee-first-name">Nombre</Label>
                <Input
                  id="employee-first-name"
                  value={firstName}
                  onChange={(event) =>
                    setField("firstName", event.target.value, setFirstName)
                  }
                  placeholder="Ej. Lucía"
                  aria-invalid={!!errors.firstName}
                />
                <FieldError message={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-last-name">Apellido</Label>
                <Input
                  id="employee-last-name"
                  value={lastName}
                  onChange={(event) =>
                    setField("lastName", event.target.value, setLastName)
                  }
                  placeholder="Ej. Fernández"
                  aria-invalid={!!errors.lastName}
                />
                <FieldError message={errors.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-cuil">DNI / CUIL</Label>
                <Input
                  id="employee-cuil"
                  value={cuil}
                  onChange={(event) =>
                    setField("cuil", event.target.value, setCuil)
                  }
                  placeholder="20-25123456-7"
                  aria-invalid={!!errors.cuil}
                />
                <FieldError message={errors.cuil} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-phone">Teléfono</Label>
                <Input
                  id="employee-phone"
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
                <Label htmlFor="employee-email">Correo electrónico</Label>
                <Input
                  id="employee-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setField("email", event.target.value, setEmail)
                  }
                  placeholder="empleado@empresa.com"
                  aria-invalid={!!errors.email}
                />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-hire-date">Fecha de ingreso</Label>
                <Input
                  id="employee-hire-date"
                  type="date"
                  value={hireDate}
                  onChange={(event) =>
                    setField("hireDate", event.target.value, setHireDate)
                  }
                  aria-invalid={!!errors.hireDate}
                />
                <FieldError message={errors.hireDate} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="employee-role">Rol</Label>
                <Select
                  value={role || undefined}
                  onValueChange={(value) => setRole(value ?? "")}
                >
                  <SelectTrigger id="employee-role" className="w-full">
                    <SelectValue placeholder="Seleccionar rol">
                      {(selected) =>
                        selected
                          ? employeeRoleLabels[selected as EmployeeRole] ?? selected
                          : "Seleccionar rol"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(employeeRoleLabels) as EmployeeRole[]).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {employeeRoleLabels[key]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="employee-password">Contraseña de acceso</Label>
                <Input
                  id="employee-password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setField("password", event.target.value, setPassword)
                  }
                  minLength={6}
                  placeholder="Mínimo 6 caracteres (opcional)"
                  aria-invalid={!!errors.password}
                  aria-describedby="employee-password-hint"
                />
                <p id="employee-password-hint" className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres.
                </p>
                <FieldError message={errors.password} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="employee-confirm-password">Confirmar contraseña</Label>
                <Input
                  id="employee-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setField("confirmPassword", event.target.value, setConfirmPassword)
                  }
                  placeholder="Repetir contraseña"
                  aria-invalid={!!errors.confirmPassword}
                />
                <FieldError message={errors.confirmPassword} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editing ? "Guardar cambios" : "Crear empleado"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}