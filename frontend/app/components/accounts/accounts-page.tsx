import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { TableSkeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { refreshCustomers, useCustomers } from "../customers/customers-store";
import { refreshProviders, useProviders } from "../purchases/purchases-store";
import { formatInputDate } from "../sales/sales-types";
import { formatMoney } from "~/lib/currency";
import {
  filtrosPorDefecto,
  listarCuentas,
  type CuentasCorrientesFiltros,
  type ListadoCuentas,
  type TipoCuenta,
} from "./accounts-api";

function Total({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight
            ? "text-xl font-semibold tabular-nums"
            : "font-medium tabular-nums"
        }
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}

export function AccountsPage({ tipo }: { tipo: TipoCuenta }) {
  const [searchParams] = useSearchParams();
  const porDefecto = filtrosPorDefecto();
  const claveEntidad = tipo === "cliente" ? "id_cliente" : "id_proveedor";
  const [desde, setDesde] = useState(
    () => searchParams.get("desde") ?? porDefecto.desde
  );
  const [hasta, setHasta] = useState(
    () => searchParams.get("hasta") ?? porDefecto.hasta
  );
  const [idEntidad, setIdEntidad] = useState(
    () => searchParams.get(claveEntidad) ?? ""
  );
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState<ListadoCuentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientes = useCustomers();
  const proveedores = useProviders();

  const filtros: CuentasCorrientesFiltros = useMemo(
    () =>
      tipo === "cliente"
        ? { desde, hasta, id_cliente: idEntidad || undefined }
        : { desde, hasta, id_proveedor: idEntidad || undefined },
    [tipo, desde, hasta, idEntidad]
  );

  useEffect(() => {
    void (tipo === "cliente" ? refreshCustomers() : refreshProviders()).catch(
      () => setError("No se pudieron cargar las entidades.")
    );
  }, [tipo]);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    listarCuentas(tipo, filtros)
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!activo) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar las cuentas corrientes."
        );
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [tipo, filtros]);

  const opciones: ComboboxOption[] = useMemo(() => {
    const todas: ComboboxOption = { value: "", label: "Todas las entidades" };
    if (tipo === "cliente") {
      return [
        todas,
        ...clientes.map((cliente) => ({
          value: cliente.id,
          label: `${cliente.firstName} ${cliente.lastName}`.trim(),
          keywords: [cliente.document, cliente.email],
        })),
      ];
    }
    return [
      todas,
      ...proveedores.map((proveedor) => ({
        value: proveedor.id,
        label: proveedor.name,
        keywords: [proveedor.cuit, proveedor.email],
      })),
    ];
  }, [tipo, clientes, proveedores]);

  const resumenes = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es");
    if (!texto) return datos?.resumenes ?? [];
    return (datos?.resumenes ?? []).filter((resumen) =>
      `${resumen.nombre} ${resumen.documento}`
        .toLocaleLowerCase("es")
        .includes(texto)
    );
  }, [datos, busqueda]);

  const rutaDetalle = tipo === "cliente" ? "customers" : "providers";
  const queryDetalle = new URLSearchParams({
    desde: datos?.desde ?? desde,
    hasta: datos?.hasta ?? hasta,
  }).toString();

  function limpiarFiltros() {
    setDesde(porDefecto.desde);
    setHasta(porDefecto.hasta);
    setIdEntidad("");
    setBusqueda("");
  }

  const titulo =
    tipo === "cliente" ? "Cuentas corrientes de clientes" : "Cuentas corrientes de proveedores";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{titulo}</h1>
          <p className="text-muted-foreground">
            Saldos derivados de comprobantes y pagos aprobados.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="cuenta-desde">Desde</Label>
            <Input
              id="cuenta-desde"
              type="date"
              className="w-40"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cuenta-hasta">Hasta</Label>
            <Input
              id="cuenta-hasta"
              type="date"
              className="w-40"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{tipo === "cliente" ? "Cliente" : "Proveedor"}</Label>
            <Combobox
              value={idEntidad}
              onValueChange={setIdEntidad}
              options={opciones}
              placeholder={tipo === "cliente" ? "Todos los clientes" : "Todos los proveedores"}
              searchPlaceholder="Buscar entidad…"
              className="w-56"
            />
          </div>
          <Button variant="ghost" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {datos && (
        <Card>
          <CardHeader>
            <CardTitle>Totales del periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <Total label="Saldo inicial" value={datos.totales.saldoInicial} />
              <Total label="Cargos" value={datos.totales.totalCargo} />
              <Total label="Abonos" value={datos.totales.totalAbono} />
              <Total
                label="Saldo final"
                value={datos.totales.saldoFinal}
                highlight
              />
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Detalle por entidad</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-full pl-9"
                placeholder="Buscar en el listado…"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </div>
            <Badge variant="secondary">
              {datos?.totales.cantidadEntidades ?? 0} entidades
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Cargos</TableHead>
                  <TableHead className="text-right">Abonos</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className="text-right">Cuenta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No hay movimientos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  resumenes.map((resumen) => (
                    <TableRow key={resumen.id}>
                      <TableCell className="font-medium">{resumen.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {resumen.documento || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(resumen.saldoInicial)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(resumen.totalCargo)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(resumen.totalAbono)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(resumen.saldoFinal)}
                      </TableCell>
                      <TableCell>
                        {resumen.ultimaActividad
                          ? formatInputDate(resumen.ultimaActividad)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          className="text-sm font-medium text-primary hover:underline"
                          to={`/${rutaDetalle}/accounts/${encodeURIComponent(resumen.id)}?${queryDetalle}`}
                        >
                          Ver cuenta
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerAccountsPage() {
  return <AccountsPage tipo="cliente" />;
}

export function ProviderAccountsPage() {
  return <AccountsPage tipo="proveedor" />;
}
