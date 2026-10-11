import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
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

import { requireText, validateEmail } from "~/lib/validation";
import { formatDate } from "../sales/sales-types";
import {
  employeeRoleLabels,
  type Employee,
  type EmployeeRole,
} from "../employees/employees-types";
import { addEmployee, useEmployees } from "../employees/employees-store";
import { loginUser, useCurrentUser } from "./session-store";
import { AuthSplitLayout } from "./auth-split-layout";

export function RegisterPage() {
  const navigate = useNavigate();
  const employees = useEmployees();
  const currentUser = useCurrentUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EmployeeRole>("ventas");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  if (currentUser) return <Navigate to="/dashboard" replace />;

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void
  ) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailTaken = employees.some(
      (employee) => employee.email.toLowerCase() === email.trim().toLowerCase()
    );
    const next: Record<string, string | null> = {
      firstName: requireText(firstName, "Nombre"),
      lastName: requireText(lastName, "Apellido"),
      email: email.trim()
        ? emailTaken
          ? "Ya existe una cuenta con ese correo."
          : validateEmail(email)
        : requireText(email, "Correo electrónico"),
      password: password.trim()
        ? password.trim().length < 6
          ? "Debe tener al menos 6 caracteres"
          : null
        : requireText(password, "Contraseña"),
      confirmPassword: confirmPassword.trim()
        ? confirmPassword.trim() !== password.trim()
          ? "Las contraseñas no coinciden"
          : null
        : requireText(confirmPassword, "Confirmar contraseña"),
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;

    const employee: Employee = {
      id: crypto.randomUUID(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      cuil: "20-00000000-0",
      phone: "",
      email: email.trim(),
      hireDate: formatDate(new Date()),
      role,
      password: password.trim(),
    };
    addEmployee(employee);
    loginUser(employee.email, employee.password ?? "");
    navigate("/dashboard");
  }

  return (
    <AuthSplitLayout
      title="Crea tu cuenta"
      subtitle="Comienza a gestionar tus ventas hoy mismo."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés una cuenta?{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Inicia sesión
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="register-first-name">Nombre</Label>
            <Input
              id="register-first-name"
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
            <Label htmlFor="register-last-name">Apellido</Label>
            <Input
              id="register-last-name"
              value={lastName}
              onChange={(event) =>
                setField("lastName", event.target.value, setLastName)
              }
              placeholder="Ej. Fernández"
              aria-invalid={!!errors.lastName}
            />
            <FieldError message={errors.lastName} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Correo electrónico</Label>
          <Input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) =>
              setField("email", event.target.value, setEmail)
            }
            placeholder="usuario@correo.com"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-role">Rol</Label>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as EmployeeRole)}
          >
            <SelectTrigger id="register-role" className="w-full">
              <SelectValue>
                {(selected) =>
                  employeeRoleLabels[(selected as EmployeeRole) ?? role] ?? role
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(employeeRoleLabels) as EmployeeRole[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {employeeRoleLabels[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Contraseña</Label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) =>
              setField("password", event.target.value, setPassword)
            }
            placeholder="Mínimo 6 caracteres"
            aria-invalid={!!errors.password}
          />
          <FieldError message={errors.password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm-password">Confirmar contraseña</Label>
          <Input
            id="register-confirm-password"
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
        <Button className="w-full" size="lg" type="submit">
          Crear cuenta
        </Button>
      </form>
    </AuthSplitLayout>
  );
}