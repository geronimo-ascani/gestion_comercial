import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router";

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
import { requireText, validateEmail } from "~/lib/validation";
import { defaultRouteForRole } from "~/lib/permissions";

import { useCurrentUser } from "../auth/session-store";
import {
  actualizarEmpresa,
  obtenerEmpresaActual,
  type EmpresaApi,
} from "../payments/payments-api";

const condicionIvaLabels: Record<EmpresaApi["condicion_iva"], string> = {
  responsable_inscripto: "Responsable inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
};

function cuitCompleto(cuit: string): boolean {
  return cuit.replace(/\D/g, "").length === 11;
}

export function CompanyPage() {
  const currentUser = useCurrentUser();
  const canEdit = currentUser?.role === "administrador";

  const [empresa, setEmpresa] = useState<EmpresaApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const [razonSocial, setRazonSocial] = useState("");
  const [nombreFantasia, setNombreFantasia] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionIva, setCondicionIva] =
    useState<EmpresaApi["condicion_iva"]>("responsable_inscripto");
  const [domicilio, setDomicilio] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("0001");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ingresosBrutos, setIngresosBrutos] = useState("");
  const [inicioActividades, setInicioActividades] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    obtenerEmpresaActual()
      .then((data) => {
        if (cancelled) return;
        setEmpresa(data);
        setRazonSocial(data.razon_social);
        setNombreFantasia(data.nombre_fantasia);
        setCuit(data.cuit);
        setCondicionIva(data.condicion_iva);
        setDomicilio(data.domicilio);
        setPuntoVenta(data.punto_venta);
        setEmail(data.email);
        setTelefono(data.telefono);
        setIngresosBrutos(data.ingresos_brutos);
        setInicioActividades(data.inicio_actividades ?? "");
        setCodigoPostal(data.codigo_postal);
        setLocalidad(data.localidad);
        setProvincia(data.provincia);
        setActiva(data.activa);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los datos de la empresa."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void
  ) {
    setter(value);
    setErrors((previous) => ({ ...previous, [field]: null }));
    setSubmitError(null);
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!empresa || !canEdit) return;

    const cuitDigitos = cuit.replace(/\D/g, "");
    const next: Record<string, string | null> = {
      razonSocial: requireText(razonSocial, "Razón social"),
      cuit:
        cuitDigitos.length === 11
          ? null
          : "El CUIT debe contener 11 dígitos",
      email: validateEmail(email),
      puntoVenta:
        puntoVenta.trim() && /^\d+$/.test(puntoVenta.trim())
          ? null
          : "El punto de venta debe contener solo números",
    };
    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      const actualizada = await actualizarEmpresa(empresa.id_empresa, {
        razon_social: razonSocial.trim(),
        nombre_fantasia: nombreFantasia.trim(),
        cuit: cuitDigitos,
        condicion_iva: condicionIva,
        domicilio: domicilio.trim(),
        punto_venta: puntoVenta.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        ingresos_brutos: ingresosBrutos.trim(),
        inicio_actividades: inicioActividades || null,
        codigo_postal: codigoPostal.trim(),
        localidad: localidad.trim(),
        provincia: provincia.trim(),
        activa,
      });
      setEmpresa(actualizada);
      setCuit(actualizada.cuit);
      setPuntoVenta(actualizada.punto_venta);
      setSaved(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la empresa."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormPage
        backLabel="Volver"
        backTo={defaultRouteForRole(currentUser?.role)}
        title="Mi empresa"
      >
        <p role="status" className="text-sm text-muted-foreground">
          Cargando datos…
        </p>
      </FormPage>
    );
  }

  if (loadError) {
    return (
      <FormPage
        backLabel="Volver"
        backTo={defaultRouteForRole(currentUser?.role)}
        title="Mi empresa"
      >
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      </FormPage>
    );
  }

  if (!empresa) {
    return <Navigate to={defaultRouteForRole(currentUser?.role)} replace />;
  }

  const fiscalIncompleta = !cuitCompleto(cuit);

  return (
    <FormPage
      backLabel="Volver"
      backTo={defaultRouteForRole(currentUser?.role)}
      title="Mi empresa"
      description="Estos datos identifican a la empresa emisora de comprobantes. Cada organización administra únicamente su propia información."
    >
      {fiscalIncompleta && (
        <div
          role="alert"
          className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400"
        >
          Completá el CUIT de 11 dígitos para poder emitir comprobantes. Mientras
          tanto podés seguir usando el resto del sistema.
        </div>
      )}
      {!activa && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          La empresa está inactiva: no se pueden emitir comprobantes.
        </div>
      )}

      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-razon-social">Razón social</Label>
                <Input
                  id="company-razon-social"
                  value={razonSocial}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField(
                      "razonSocial",
                      event.target.value,
                      setRazonSocial
                    )
                  }
                  aria-invalid={!!errors.razonSocial}
                />
                <FieldError message={errors.razonSocial} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-nombre-fantasia">
                  Nombre de fantasía
                </Label>
                <Input
                  id="company-nombre-fantasia"
                  value={nombreFantasia}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField(
                      "nombreFantasia",
                      event.target.value,
                      setNombreFantasia
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-cuit">CUIT</Label>
                <Input
                  id="company-cuit"
                  value={cuit}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("cuit", event.target.value, setCuit)
                  }
                  aria-invalid={!!errors.cuit}
                />
                <FieldError message={errors.cuit} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-condicion-iva">Condición de IVA</Label>
                <Select
                  value={condicionIva}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    value && setCondicionIva(value as EmpresaApi["condicion_iva"])
                  }
                >
                  <SelectTrigger
                    id="company-condicion-iva"
                    className="w-full"
                  >
                    <SelectValue>{condicionIvaLabels[condicionIva]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(condicionIvaLabels) as EmpresaApi["condicion_iva"][]
                    ).map((item) => (
                      <SelectItem key={item} value={item}>
                        {condicionIvaLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-domicilio">Domicilio</Label>
                <Input
                  id="company-domicilio"
                  value={domicilio}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("domicilio", event.target.value, setDomicilio)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-punto-venta">Punto de venta</Label>
                <Input
                  id="company-punto-venta"
                  value={puntoVenta}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("puntoVenta", event.target.value, setPuntoVenta)
                  }
                  aria-invalid={!!errors.puntoVenta}
                />
                <FieldError message={errors.puntoVenta} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-email">Correo electrónico</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={email}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("email", event.target.value, setEmail)
                  }
                  aria-invalid={!!errors.email}
                />
                <FieldError message={errors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-telefono">Teléfono</Label>
                <Input
                  id="company-telefono"
                  value={telefono}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("telefono", event.target.value, setTelefono)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-ingresos-brutos">
                  Ingresos brutos
                </Label>
                <Input
                  id="company-ingresos-brutos"
                  value={ingresosBrutos}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField(
                      "ingresosBrutos",
                      event.target.value,
                      setIngresosBrutos
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-inicio-actividades">
                  Inicio de actividades
                </Label>
                <Input
                  id="company-inicio-actividades"
                  type="date"
                  value={inicioActividades}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField(
                      "inicioActividades",
                      event.target.value,
                      setInicioActividades
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-codigo-postal">Código postal</Label>
                <Input
                  id="company-codigo-postal"
                  value={codigoPostal}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField(
                      "codigoPostal",
                      event.target.value,
                      setCodigoPostal
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-localidad">Localidad</Label>
                <Input
                  id="company-localidad"
                  value={localidad}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("localidad", event.target.value, setLocalidad)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-provincia">Provincia</Label>
                <Input
                  id="company-provincia"
                  value={provincia}
                  readOnly={!canEdit}
                  onChange={(event) =>
                    setField("provincia", event.target.value, setProvincia)
                  }
                />
              </div>
            </div>

            {canEdit && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={(event) => {
                    setActiva(event.target.checked);
                    setSubmitError(null);
                    setSaved(false);
                  }}
                  className="size-4 rounded border-border"
                />
                Empresa activa (puede emitir comprobantes)
              </label>
            )}

            {submitError && (
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            )}
            {saved && (
              <p role="status" className="text-sm text-emerald-600">
                Los datos de la empresa se guardaron correctamente.
              </p>
            )}
          </CardContent>
          {canEdit && (
            <CardFooter className="justify-end gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>
    </FormPage>
  );
}
