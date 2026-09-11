import { useState, type FormEvent } from "react";
import { LogOut, Search } from "lucide-react";

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
} from "~/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { requireText } from "~/lib/validation";
import {
  employeeRoleLabels,
  type EmployeeRole,
} from "../employees/employees-types";
import { updateEmployee, useEmployees } from "../employees/employees-store";
import {
  changePassword,
  logoutUser,
  useCurrentUser,
} from "../auth/session-store";

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

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
    const next: Record<string, string | null> = {
      currentPassword: requireText(currentPassword, "Contraseña actual"),
      newPassword:
        newPassword.trim().length === 0
          ? "La nueva contraseña es obligatoria"
          : newPassword.trim().length < 6
            ? "Debe tener al menos 6 caracteres"
            : null,
      confirmPassword:
        confirmPassword.trim().length === 0
          ? "Confirme la contraseña"
          : confirmPassword.trim() !== newPassword.trim()
            ? "Las contraseñas no coinciden"
            : null,
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;

    const result = changePassword(currentPassword, newPassword.trim());
    if (result) {
      setErrors({ currentPassword: result });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar mi contraseña</DialogTitle>
          <DialogDescription>
            Ingrese su contraseña actual y luego la nueva.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) =>
                setField("currentPassword", event.target.value, setCurrentPassword)
              }
              aria-invalid={!!errors.currentPassword}
            />
            <FieldError message={errors.currentPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) =>
                setField("newPassword", event.target.value, setNewPassword)
              }
              placeholder="Mínimo 6 caracteres"
              aria-invalid={!!errors.newPassword}
            />
            <FieldError message={errors.newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
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
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar contraseña</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsPage() {
  const employees = useEmployees();
  const currentUser = useCurrentUser();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = employees.filter((employee) => {
    const haystack =
      `${employee.firstName} ${employee.lastName} ${employee.cuil} ${employee.email}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Usuarios y roles de la organización.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser ? (
            <span className="text-sm text-muted-foreground">
              Sesión: {currentUser.firstName} {currentUser.lastName}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Sin sesión iniciada
            </span>
          )}
          <Button
            onClick={() => setPasswordOpen(true)}
            disabled={!currentUser}
            title={
              currentUser
                ? "Cambiar su contraseña"
                : "Inicie sesión para cambiar su contraseña"
            }
          >
            Cambiar mi contraseña
          </Button>
          {currentUser && (
            <Button variant="outline" onClick={logoutUser}>
              <LogOut />
              Cerrar sesión
            </Button>
          )}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {(Object.entries(employeeRoleLabels) as [
            EmployeeRole,
            string,
          ][]).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">
                {key === "ventas" &&
                  "Gestiona clientes, presupuestos y órdenes de venta."}
                {key === "abastecimiento" &&
                  "Gestiona proveedores, órdenes de compra y stock."}
                {key === "administrador" &&
                  "Acceso completo: configuración, usuarios y pagos."}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Empleados registrados</CardTitle>
          </div>
          <Badge variant="secondary">{employees.length} empleados</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar empleado por nombre, DNI/CUIL o correo..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre y apellido</TableHead>
                <TableHead>DNI / CUIL</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead className="w-44">Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {employees.length === 0
                      ? "No hay empleados registrados."
                      : "No se encontraron resultados."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {employee.cuil || "—"}
                    </TableCell>
                    <TableCell>{employee.email || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={employee.role}
                        onValueChange={(value) =>
                          updateEmployee(employee.id, {
                            role: (value as EmployeeRole) || employee.role,
                          })
                        }
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={`Rol de ${employee.firstName} ${employee.lastName}`}
                        >
                          <SelectValue />
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {filtered.length} empleados</span>
        </CardFooter>
      </Card>

      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </div>
  );
}