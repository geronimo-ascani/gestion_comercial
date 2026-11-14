import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Navigate, useNavigate } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
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
import { useDebouncedValue } from "~/lib/use-debounced-value";
import {
  loadEmployees,
  removeEmployee,
  useEmployees,
} from "./employees-store";
import { logoutUser, useCurrentUser } from "../auth/session-store";

function ConfirmDeleteEmployee({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Eliminar empleado ${name}`}
          >
            <Trash2 />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar empleado</DialogTitle>
          <DialogDescription>
            Se eliminará físicamente la cuenta de {name}. Si tiene pedidos o
            registros asociados, la operación será rechazada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" onClick={onDelete} />}
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
  const currentUser = useCurrentUser();
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query);

  const employees = useEmployees();
  const loading = useInitialLoading();

  useEffect(() => {
    void loadEmployees().catch((error: unknown) => {
      setLoadError(
        error instanceof Error ? error.message : "No se pudieron cargar los empleados."
      );
    });
  }, []);

  if (currentUser?.role !== "administrador") {
    return <Navigate to="/dashboard" replace />;
  }

  const filtered = employees.filter((employee) => {
    const haystack =
      `${employee.firstName} ${employee.lastName} ${employee.cuil} ${employee.phone} ${employee.email} ${
        employee.position
      } ${
        employee.role ? employeeRoleLabels[employee.role] : ""
      }`.toLowerCase();
    return haystack.includes(debouncedQuery.trim().toLowerCase());
  });

  function openNewEmployee() {
    navigate("/employees/new");
  }

  async function handleDelete(employeeId: string) {
    setActionError(null);
    try {
      await removeEmployee(employeeId);
      if (currentUser?.id === employeeId) {
        logoutUser();
        navigate("/login", { replace: true });
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el empleado.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">
            Usuarios y roles de acceso de la organización.
          </p>
        </div>
        <Button onClick={openNewEmployee}>
          <Plus />
          Nuevo empleado
        </Button>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

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
          <TableSkeleton rows={6} columns={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre y apellido</TableHead>
                  <TableHead>DNI / CUIL</TableHead>
                  <TableHead>Puesto</TableHead>
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
                    colSpan={8}
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
                    <TableCell>{employee.position || "—"}</TableCell>
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
                            navigate(`/employees/${encodeURIComponent(employee.id)}/edit`)
                          }
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDeleteEmployee
                          name={`${employee.firstName} ${employee.lastName}`}
                          onDelete={() => void handleDelete(employee.id)}
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