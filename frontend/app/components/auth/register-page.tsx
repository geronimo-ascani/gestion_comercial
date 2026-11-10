import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { requireText, validateEmail } from "~/lib/validation";

import { refreshEmployees } from "../employees/employees-store";
import {
  employeeRoleLabels,
  type EmployeeRole,
} from "../employees/employees-types";
import { mapUsuario, registrarUsuario } from "./auth-api";
import { AuthSplitLayout } from "./auth-split-layout";
import {
  acceptRegisteredSession,
  initializeSession,
  useCurrentUser,
  useSessionInitialized,
} from "./session-store";

export function RegisterPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const sessionInitialized = useSessionInitialized();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cuil, setCuil] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("ventas");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void initializeSession().catch((error: unknown) => {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo validar la sesión."
      );
    });
  }, []);

  if (currentUser && currentUser.role !== "administrador") {
    return <Navigate to="/dashboard" replace />;
  }

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
      cuil: requireText(cuil, "DNI/CUIL"),
      phone: requireText(phone, "Teléfono"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      password: password.length < 8 ? "Debe tener al menos 8 caracteres" : null,
      confirmPassword:
        confirmPassword !== password ? "Las contraseñas no coinciden" : null,
    };
    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some(Boolean)) return;

    const now = new Date();
    const fechaIngreso = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    setSubmitting(true);
    try {
      const response = await registrarUsuario({
        nombre: firstName.trim(),
        apellido: lastName.trim(),
        dni_cuil: cuil.trim(),
        telefono: phone.trim(),
        email: email.trim(),
        fecha_ingreso: fechaIngreso,
        password,
        rol: currentUser ? role : "ventas",
      });

      if (response.access_token) {
        acceptRegisteredSession(
          response.access_token,
          mapUsuario(response.user)
        );
        navigate("/dashboard");
      } else {
        await refreshEmployees();
        navigate("/employees");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo crear la cuenta."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionInitialized) {
    return (
      <AuthSplitLayout
        title="Cargando"
        subtitle="Verificando la sesión actual."
        footer={<span />}
      >
        <p role="status" className="text-center text-sm text-muted-foreground">
          Un momento…
        </p>
      </AuthSplitLayout>
    );
  }

  const creatingEmployee = currentUser?.role === "administrador";

  return (
    <AuthSplitLayout
      title={creatingEmployee ? "Crear usuario de empleado" : "Crea tu cuenta"}
      subtitle={
        creatingEmployee
          ? "El empleado podrá iniciar sesión con estas credenciales."
          : "El primer registro será el administrador de la organización."
      }
      footer={
        creatingEmployee ? (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/employees"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Volver a empleados
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés una cuenta?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Inicia sesión
            </Link>
          </p>
        )
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
              aria-invalid={!!errors.lastName}
            />
            <FieldError message={errors.lastName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-cuil">DNI / CUIL</Label>
            <Input
              id="register-cuil"
              value={cuil}
              onChange={(event) =>
                setField("cuil", event.target.value, setCuil)
              }
              aria-invalid={!!errors.cuil}
            />
            <FieldError message={errors.cuil} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-phone">Teléfono</Label>
            <Input
              id="register-phone"
              value={phone}
              onChange={(event) =>
                setField("phone", event.target.value, setPhone)
              }
              aria-invalid={!!errors.phone}
            />
            <FieldError message={errors.phone} />
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
            autoComplete="email"
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>
        {creatingEmployee && (
          <div className="space-y-2">
            <Label htmlFor="register-role">Rol</Label>
            <Select value={role} onValueChange={(value) => value && setRole(value as EmployeeRole)}>
              <SelectTrigger id="register-role" className="w-full">
                <SelectValue>{employeeRoleLabels[role]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(employeeRoleLabels) as EmployeeRole[]).map(
                  (item) => (
                    <SelectItem key={item} value={item}>
                      {employeeRoleLabels[item]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="register-password">Contraseña</Label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) =>
              setField("password", event.target.value, setPassword)
            }
            autoComplete="new-password"
            aria-invalid={!!errors.password}
          />
          <FieldError message={errors.password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm-password">
            Confirmar contraseña
          </Label>
          <Input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setField(
                "confirmPassword",
                event.target.value,
                setConfirmPassword
              )
            }
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
          />
          <FieldError message={errors.confirmPassword} />
        </div>
        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}
        <Button className="w-full" size="lg" type="submit" disabled={submitting}>
          {submitting
            ? "Guardando…"
            : creatingEmployee
              ? "Crear empleado"
              : "Crear cuenta"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
