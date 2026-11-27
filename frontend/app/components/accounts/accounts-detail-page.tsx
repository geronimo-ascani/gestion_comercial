import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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

import { formatAddress } from "~/lib/address";
import { formatMoney } from "~/lib/currency";
import { getCustomer } from "../customers/customers-api";
import { getProvider } from "../purchases/providers-api";
import { formatInputDate } from "../sales/sales-types";
import {
  filtrosPorDefecto,
  obtenerCuenta,
  type DetalleCuenta,
  type TipoCuenta,
} from "./accounts-api";

interface DatosEntidad {
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  direccion: string;
  banco?: string;
  cuenta?: string;
}

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

export function AccountDetailPage({ tipo }: { tipo: TipoCuenta }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const porDefecto = filtrosPorDefecto();
  const [desde, setDesde] = useState(
    () => searchParams.get("desde") ?? porDefecto.desde
  );
  const [hasta, setHasta] = useState(
    () => searchParams.get("hasta") ?? porDefecto.hasta
  );
  const [detalle, setDetalle] = useState<DetalleCuenta | null>(null);
  const [entidad, setEntidad] = useState<DatosEntidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtros = useMemo(() => ({ desde, hasta }), [desde, hasta]);
  const rutaListado = tipo === "cliente" ? "/customers" : "/providers";

  useEffect(() => {
    if (!id) return;
    let activo = true;
    const alFallar = () => {
      // La cuenta corriente se muestra aunque falle la carga de datos básicos.
    };
    if (tipo === "cliente") {
      void getCustomer(id)
        .then((cliente) => {
          if (!activo) return;
          setEntidad({
            nombre: `${cliente.firstName} ${cliente.lastName}`.trim(),
            documento: cliente.document,
            telefono: cliente.phone,
            email: cliente.email,
            direccion: formatAddress(cliente.address),
          });
        })
        .catch(alFallar);
    } else {
      void getProvider(id)
        .then((proveedor) => {
          if (!activo) return;
          setEntidad({
            nombre: proveedor.name,
            documento: proveedor.cuit,
            telefono: proveedor.phone,
            email: proveedor.email,
            direccion: formatAddress(proveedor.address),
            banco: proveedor.bank,
            cuenta: proveedor.account,
          });
        })
        .catch(alFallar);
    }
    return () => {
      activo = false;
    };
  }, [tipo, id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let activo = true;
    setLoading(true);
    obtenerCuenta(tipo, id, filtros)
      .then((respuesta) => {
        if (!activo) return;
        setDetalle(respuesta);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!activo) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar la cuenta corriente."
        );
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [tipo, id, filtros]);

  const titulo = tipo === "cliente" ? "Detalle de cliente" : "Detalle de proveedor";
  const campos: Array<[string, string]> = [
    ["Documento", entidad?.documento || detalle?.resumen.documento || "—"],
    ["Teléfono", entidad?.telefono || "—"],
    ["Correo electrónico", entidad?.email || "—"],
    ["Dirección", entidad?.direccion || "—"],
  ];
  if (tipo === "proveedor") {
    campos.push(["Banco", entidad?.banco || "—"]);
    campos.push(["Número de cuenta", entidad?.cuenta || "—"]);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link to={rutaListado} />}>
          <ArrowLeft />
          Volver a {tipo === "cliente" ? "clientes" : "proveedores"}
        </Button>
        <h1 className="mt-2 text-3xl font-bold">{titulo}</h1>
        <p className="text-muted-foreground">
          {entidad?.nombre ?? detalle?.resumen.nombre ?? id ?? ""}
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>
            {tipo === "cliente" ? "Datos del cliente" : "Datos del proveedor"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            {campos.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
                <dd className="break-all font-medium">{valor}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="detalle-desde">Desde</Label>
            <Input
              id="detalle-desde"
              type="date"
              className="w-40"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detalle-hasta">Hasta</Label>
            <Input
              id="detalle-hasta"
              type="date"
              className="w-40"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {detalle && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Cuenta corriente</CardTitle>
              <Badge variant="secondary">
                {detalle.resumen.cantidadDocumentos} documentos ·{" "}
                {detalle.resumen.cantidadPagos} pagos
              </Badge>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Total label="Saldo inicial" value={detalle.resumen.saldoInicial} />
                <Total label="Cargos" value={detalle.resumen.totalCargo} />
                <Total label="Abonos" value={detalle.resumen.totalAbono} />
                <Total
                  label="Saldo final"
                  value={detalle.resumen.saldoFinal}
                  highlight
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos del periodo</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Movimiento</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Medio de pago</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Saldo resultante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.movimientos.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay movimientos en el periodo seleccionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalle.movimientos.map((movimiento) => (
                        <TableRow key={movimiento.id}>
                          <TableCell>{formatInputDate(movimiento.fecha)}</TableCell>
                          <TableCell>{movimiento.descripcion}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {movimiento.numero ?? "—"}
                          </TableCell>
                          <TableCell>{movimiento.medioPago ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(movimiento.monto)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                movimiento.signo === 1 ? "default" : "secondary"
                              }
                            >
                              {movimiento.signo === 1 ? "Cargo" : "Abono"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatMoney(movimiento.saldoResultante)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function CustomerAccountDetailPage() {
  return <AccountDetailPage tipo="cliente" />;
}

export function ProviderAccountDetailPage() {
  return <AccountDetailPage tipo="proveedor" />;
}
