import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

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
  validateEmail,
  validatePhone,
} from "~/lib/validation";

import { logoutUser, useCurrentUser } from "../auth/session-store";
import {
  createEmployee,
  getEmployee,
  updateEmployee,
} from "./employees-store";
import {
  employeeRoleLabels,
  type Employee,
  type EmployeeRole,
} from "./employees-types";

function todayForInput(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function EmployeeFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useCurrentUser();
  const editing = Boolean(id);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hireDate, setHireDate] = useState(todayForInput);
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<EmployeeRole>("ventas");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setSubmitError(null);
    getEmployee(id)
      .then((loadedEmployee) => {
        if (cancelled) return;
        setEmployee(loadedEmployee);
        setFirstName(loadedEmployee.firstName);
        setLastName(loadedEmployee.lastName);
        setDocument(loadedEmployee.cuil);
        setPhone(loadedEmployee.phone);
        setEmail(loadedEmployee.email);
        setHireDate(loadedEmployee.hireDateISO);
        setPosition(loadedEmployee.position);
        setRole(loadedEmployee.role);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los datos del empleado.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void,
  ) {
    setter(value);
    setErrors((previous) => ({ ...previous, [field]: null }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string | null> = {
      firstName: requireText(firstName, "Nombre"),
      lastName: requireText(lastName, "Apellido"),
      document: requireText(document, "DNI/CUIL"),
      phone: phone.trim()
        ? validatePhone(phone)
        : requireText(phone, "Teléfono"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      hireDate: requireText(hireDate, "Fecha de ingreso"),
      position: requireText(position, "Puesto"),
    };
    if (!editing) {
      nextErrors.password =
        password.length < 8 ? "Debe tener al menos 8 caracteres" : null;
      nextErrors.confirmPassword =
        confirmPassword !== password ? "Las contraseñas no coinciden" : null;
    }
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.values(nextErrors).some(Boolean)) return;

    const employeeData = {
      nombre: firstName.trim(),
      apellido: lastName.trim(),
      dni_cuil: document.trim(),
      telefono: phone.trim(),
      email: email.trim(),
      fecha_ingreso: hireDate,
      puesto: position.trim(),
      rol: role,
    };

    setSaving(true);
    try {
      if (id) {
        await updateEmployee(id, employeeData);
        if (currentUser?.id === id) {
          logoutUser();
          navigate("/login", { replace: true });
          return;
        }
      } else {
        await createEmployee({ ...employeeData, password });
      }
      navigate("/employees");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el empleado.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (currentUser?.role !== "administrador") {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <FormPage
        backLabel="Volver a empleados"
        backTo="/employees"
        title="Cargando empleado"
      >
        <p role="status" className="text-sm text-muted-foreground">
          Cargando datos…
        </p>
      </FormPage>
    );
  }

  if (editing && !employee) {
    return (
      <FormPage
        backLabel="Volver a empleados"
        backTo="/employees"
        title="No se pudo abrir el empleado"
      >
        <p role="alert" className="text-sm text-destructive">
          {submitError ?? "El empleado solicitado no está disponible."}
        </p>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver a empleados"
      backTo="/employees"
      title={editing ? "Editar empleado" : "Nuevo empleado"}
      description={
        editing
          ? "Actualizá los datos personales, el puesto y el rol de acceso."
          : "Cargá los datos de la persona y sus credenciales de acceso."
      }
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {submitError && (
              <p
                className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                role="alert"
              >
                {submitError}
              </p>
            )}

            <section className="space-y-4">
              <h2 className="text-base font-semibold">Datos personales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-first-name">Nombre</Label>
                  <Input
                    id="employee-first-name"
                    value={firstName}
                    onChange={(event) =>
                      setField("firstName", event.target.value, setFirstName)
                    }
                    aria-invalid={Boolean(errors.firstName)}
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
                    aria-invalid={Boolean(errors.lastName)}
                  />
                  <FieldError message={errors.lastName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-document">DNI / CUIL</Label>
                  <Input
                    id="employee-document"
                    value={document}
                    onChange={(event) =>
                      setField("document", event.target.value, setDocument)
                    }
                    aria-invalid={Boolean(errors.document)}
                  />
                  <FieldError message={errors.document} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-phone">Teléfono</Label>
                  <Input
                    id="employee-phone"
                    value={phone}
                    onChange={(event) =>
                      setField("phone", event.target.value, setPhone)
                    }
                    aria-invalid={Boolean(errors.phone)}
                  />
                  <FieldError message={errors.phone} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="employee-email">Correo electrónico</Label>
                  <Input
                    id="employee-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setField("email", event.target.value, setEmail)
                    }
                    aria-invalid={Boolean(errors.email)}
                  />
                  <FieldError message={errors.email} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">Datos laborales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-hire-date">Fecha de ingreso</Label>
                  <Input
                    id="employee-hire-date"
                    type="date"
                    value={hireDate}
                    onChange={(event) =>
                      setField("hireDate", event.target.value, setHireDate)
                    }
                    aria-invalid={Boolean(errors.hireDate)}
                  />
                  <FieldError message={errors.hireDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-position">Puesto</Label>
                  <Input
                    id="employee-position"
                    value={position}
                    onChange={(event) =>
                      setField("position", event.target.value, setPosition)
                    }
                    aria-invalid={Boolean(errors.position)}
                  />
                  <FieldError message={errors.position} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-role">Rol de acceso</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => {
                      if (value) {
                        setRole(value as EmployeeRole);
                        setSubmitError(null);
                      }
                    }}
                  >
                    <SelectTrigger id="employee-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(employeeRoleLabels).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {!editing && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold">Acceso a la cuenta</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-password">Contraseña</Label>
                    <Input
                      id="employee-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) =>
                        setField("password", event.target.value, setPassword)
                      }
                      aria-invalid={Boolean(errors.password)}
                    />
                    <FieldError message={errors.password} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-confirm-password">
                      Confirmar contraseña
                    </Label>
                    <Input
                      id="employee-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setField(
                          "confirmPassword",
                          event.target.value,
                          setConfirmPassword,
                        )
                      }
                      aria-invalid={Boolean(errors.confirmPassword)}
                    />
                    <FieldError message={errors.confirmPassword} />
                  </div>
                </div>
              </section>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => navigate("/employees")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear empleado"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}
