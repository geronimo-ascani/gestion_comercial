import { useState, type ReactElement } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { employeeRoleLabels } from "./employees-types";
import { TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import { removeEmployee, useEmployees } from "./employees-store";

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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const employees = useEmployees();
  const loading = useInitialLoading();

  const filtered = employees.filter((employee) => {
    const haystack =
      `${employee.firstName} ${employee.lastName} ${employee.cuil} ${employee.phone} ${employee.email} ${
        employee.role ? employeeRoleLabels[employee.role] : ""
      }`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function openNewEmployee() {
    navigate("/employees/new");
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar empleado por nombre, DNI/CUIL, correo o rol..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {query && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {employees.length} empleados
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Empleados</CardTitle>
          </div>
          <Badge variant="secondary">{employees.length} empleados</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : (
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {employees.length === 0
                      ? "No hay empleados registrados."
                      : "No se encontraron empleados para la búsqueda."}
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
                          onClick={() =>
                            navigate(`/employees/new?edit=${employee.id}`)
                          }
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
          )}
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {filtered.length} de {employees.length} empleados</span>
        </CardFooter>
      </Card>
    </div>
  );
}