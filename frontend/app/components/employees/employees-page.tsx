import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { formatInputDate } from "../sales/sales-types";
import {
  requireText,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";
import { employeeRoleLabels, type Employee, type EmployeeRole } from "./employees-types";
import {
  addEmployee,
  removeEmployee,
  updateEmployee,
  useEmployees,
} from "./employees-store";

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSaved: (employee: Employee) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cuil, setCuil] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (open) {
      setFirstName(employee?.firstName ?? "");
      setLastName(employee?.lastName ?? "");
      setCuil(employee?.cuil ?? "");
      setPhone(employee?.phone ?? "");
      setEmail(employee?.email ?? "");
      setHireDate(employee?.hireDate ?? "");
      setRole(employee?.role ?? "");
      setPassword(employee?.password ?? "");
      setConfirmPassword("");
      setErrors({});
    }
  }, [open, employee]);

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
    onSaved({
      id: employee?.id ?? crypto.randomUUID(),
      firstName: firstName.trim() || "Sin definir",
      lastName: lastName.trim(),
      cuil: cuil.trim(),
      phone: phone.trim(),
      email: email.trim(),
      hireDate: employee?.hireDate ?? formatInputDate(hireDate),
      role: (role as EmployeeRole) || "ventas",
      password: password.trim() || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {employee ? "Editar empleado" : "Nuevo empleado"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del empleado. Nombre, apellido, DNI/CUIL,
            teléfono y fecha de ingreso son obligatorios.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
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
                  <SelectValue placeholder="Seleccionar rol" />
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
                placeholder="Mínimo 6 caracteres (opcional)"
                aria-invalid={!!errors.password}
              />
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
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">
              {employee ? "Guardar cambios" : "Crear empleado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  title,
  description,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  trigger: ReactElement;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" onClick={onConfirm} />}
          >
            Eliminar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const employees = useEmployees();

  function openNewEmployee() {
    setEditingEmployee(null);
    setFormOpen(true);
  }

  function handleSaved(employee: Employee) {
    if (editingEmployee) {
      updateEmployee(employee.id, employee);
    } else {
      addEmployee(employee);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">
            Perfiles de empleados de la organización.
          </p>
        </div>
        <Button onClick={openNewEmployee}>
          <Plus />
          Nuevo empleado
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar empleado por nombre, DNI/CUIL o cargo..."
          />
        </div>
        <Button variant="outline">Buscar</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Empleados</CardTitle>
          </div>
          <Badge variant="secondary">{employees.length} empleados</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre y apellido</TableHead>
                <TableHead>DNI / CUIL</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Fecha de ingreso</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No hay empleados registrados.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {employee.cuil || "—"}
                    </TableCell>
                    <TableCell>{employee.phone || "—"}</TableCell>
                    <TableCell>{employee.email || "—"}</TableCell>
                    <TableCell>{employee.hireDate || "—"}</TableCell>
                    <TableCell>
                      {employee.role
                        ? employeeRoleLabels[employee.role]
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar empleado ${employee.firstName} ${employee.lastName}`}
                          onClick={() => {
                            setEditingEmployee(employee);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDeleteDialog
                          title="¿Eliminar empleado?"
                          description={`Se eliminará ${employee.firstName} ${employee.lastName}. Esta acción no se puede deshacer.`}
                          onConfirm={() => removeEmployee(employee.id)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={`Eliminar empleado ${employee.firstName} ${employee.lastName}`}
                            >
                              <Trash2 />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {employees.length} empleados</span>
        </CardFooter>
      </Card>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        onSaved={handleSaved}
      />
    </div>
  );
}