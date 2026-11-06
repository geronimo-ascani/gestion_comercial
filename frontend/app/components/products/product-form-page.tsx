import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FormPage } from "~/components/ui/form-page";

import {
  formatMoney,
  parseNumberInput,
  parsePercentInput,
} from "~/lib/currency";
import { requireText } from "~/lib/validation";
import {
  actualizarProducto,
  crearProducto,
  listarAlicuotas,
  listarCategorias,
  obtenerProducto,
  type AlicuotaIva,
  type Categoria,
} from "./products-api";
import { calculateMarginValue, calculateSalePrice } from "./products-calc";
import { refreshProducts } from "./products-store";

function defaultAlicuota(alicuotas: AlicuotaIva[]): AlicuotaIva | undefined {
  return (
    alicuotas.find(
      (alicuota) =>
        alicuota.codigo_afip === "0005" && alicuota.tipo_iva === "gravado"
    ) ?? alicuotas[0]
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

export function ProductFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const editing = Boolean(editId);
  const backTo = "/products";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [alicuotas, setAlicuotas] = useState<AlicuotaIva[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [margin, setMargin] = useState("");
  const [alicuotaId, setAlicuotaId] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      listarCategorias(),
      listarAlicuotas(),
      editId ? obtenerProducto(editId) : Promise.resolve(null),
    ])
      .then(([categorias, alicuotasData, producto]) => {
        if (cancelled) return;

        setCategories(categorias);
        setAlicuotas(alicuotasData);

        if (producto) {
          setCode(producto.code);
          setName(producto.name);
          setCategoryId(producto.categoryId);
          setDescription(producto.description);
          setPurchasePrice(String(producto.purchasePrice));
          setMargin(String(producto.margin));
          setAlicuotaId(producto.alicuotaId);
          setStock(String(producto.stock));
          setMinStock(String(producto.minStock));
        } else {
          setCode("");
          setCategoryId(categorias[0]?.id_categoria ?? "");
          setAlicuotaId(
            defaultAlicuota(alicuotasData)?.id_alicuota_iva ?? ""
          );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const purchaseAmount = parseNumberInput(purchasePrice);
  const marginAmount = margin.trim() === "" ? 0 : parsePercentInput(margin);
  const selectedAlicuota = alicuotas.find(
    (alicuota) => alicuota.id_alicuota_iva === alicuotaId
  );
  const ivaRate = selectedAlicuota ? Number(selectedAlicuota.porcentaje) / 100 : 0;
  const priceValid =
    purchaseAmount > 0 && Number.isFinite(marginAmount) && marginAmount >= 0;
  const marginValueDisplay = priceValid
    ? formatMoney(calculateMarginValue(purchaseAmount, marginAmount))
    : "";
  const salePriceDisplay = priceValid
    ? formatMoney(calculateSalePrice(purchaseAmount, marginAmount, ivaRate))
    : "";

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void
  ) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre"),
      category: categoryId ? null : "Seleccione una categoría",
      alicuota: alicuotaId ? null : "Seleccione una alícuota de IVA",
      purchasePrice:
        purchasePrice.trim() === ""
          ? "El precio de compra es obligatorio"
          : purchaseAmount <= 0
            ? "El precio de compra debe ser mayor que 0"
            : null,
      margin:
        margin.trim() !== "" &&
        (!Number.isFinite(marginAmount) || marginAmount < 0)
          ? "El margen debe ser un porcentaje mayor o igual a 0"
          : null,
      stock:
        Number.isInteger(parseNumberInput(stock)) &&
        parseNumberInput(stock) >= 0
          ? null
          : "Ingrese un stock válido (entero, no negativo)",
      minStock:
        Number.isInteger(parseNumberInput(minStock)) &&
        parseNumberInput(minStock) >= 0
          ? null
          : "Ingrese un stock mínimo válido (entero, no negativo)",
    };

    setErrors(next);
    setSubmitError(null);
    if (Object.values(next).some((error) => error)) return;

    const payload = {
      nombre: name.trim(),
      descripcion: description.trim(),
      margen: marginAmount,
      precio_compra: purchaseAmount,
      stock_actual: Math.floor(parseNumberInput(stock)),
      stock_minimo: Math.floor(parseNumberInput(minStock)),
      id_alicuota_iva: alicuotaId,
      id_categoria: categoryId,
    };

    setSaving(true);
    try {
      if (editId) {
        await actualizarProducto(editId, payload);
      } else {
        await crearProducto(payload);
      }
      await refreshProducts();
      navigate(backTo);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormPage
        backLabel="Volver"
        backTo={backTo}
        title={editing ? "Editar producto" : "Nuevo producto"}
      >
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Cargando datos del producto…
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  if (loadError) {
    return (
      <FormPage
        backLabel="Volver"
        backTo={backTo}
        title={editing ? "Editar producto" : "Nuevo producto"}
      >
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Volver al listado
            </Button>
          </CardContent>
        </Card>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver"
      backTo={backTo}
      title={editing ? "Editar producto" : "Nuevo producto"}
      description="Complete los datos del producto para agregarlo al catálogo. El código se genera automáticamente."
    >
      <Card>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-code">Código</Label>
                <Input
                  id="product-code"
                  value={editing ? code : "Se genera automáticamente"}
                  disabled
                  className="font-mono text-xs"
                  aria-describedby="product-code-help"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name">Nombre</Label>
                <Input
                  id="product-name"
                  value={name}
                  onChange={(event) =>
                    setField("name", event.target.value, setName)
                  }
                  placeholder="Nombre del producto"
                  aria-invalid={!!errors.name}
                />
                <FieldError message={errors.name} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="product-category">Categoría</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  setCategoryId(value ?? "");
                  setErrors((previous) => ({ ...previous, category: null }));
                }}
              >
                <SelectTrigger id="product-category" className="w-full">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id_categoria} value={item.id_categoria}>
                      {item.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.category} />
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="product-description">Descripción</Label>
              <Textarea
                id="product-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción breve del producto"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-purchase-price">Precio de compra</Label>
                <Input
                  id="product-purchase-price"
                  inputMode="decimal"
                  value={purchasePrice}
                  onChange={(event) =>
                    setField("purchasePrice", event.target.value, setPurchasePrice)
                  }
                  placeholder="$ 0"
                  aria-invalid={!!errors.purchasePrice}
                />
                <FieldError message={errors.purchasePrice} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-margin">Margen (%)</Label>
                <Input
                  id="product-margin"
                  inputMode="decimal"
                  value={margin}
                  onChange={(event) =>
                    setField("margin", event.target.value, setMargin)
                  }
                  placeholder="0"
                  aria-invalid={!!errors.margin}
                  aria-describedby="product-margin-help"
                />
                <FieldError message={errors.margin} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-net">Neto</Label>
                <Input
                  id="product-net"
                  readOnly
                  value={marginValueDisplay}
                  placeholder="$ 0,00"
                  className="font-medium bg-muted text-muted-foreground cursor-not-allowed"
                  aria-describedby="product-net-help"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-iva-condition">Alícuota de IVA</Label>
                <Select
                  value={alicuotaId}
                  onValueChange={(value) => {
                    setAlicuotaId(value ?? "");
                    setErrors((previous) => ({ ...previous, alicuota: null }));
                  }}
                >
                  <SelectTrigger id="product-iva-condition" className="w-full">
                    <SelectValue>
                      {(value) =>
                        alicuotas.find(
                          (alicuota) => alicuota.id_alicuota_iva === value
                        )?.descripcion ?? "Seleccionar alícuota"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {alicuotas.map((alicuota) => (
                      <SelectItem
                        key={alicuota.id_alicuota_iva}
                        value={alicuota.id_alicuota_iva}
                        label={alicuota.descripcion}
                      >
                        {alicuota.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.alicuota} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="product-sale-price">Precio de venta</Label>
              <Input
                id="product-sale-price"
                readOnly
                value={salePriceDisplay}
                placeholder="$ 0,00"
                className="font-medium bg-muted text-muted-foreground cursor-not-allowed"
                aria-describedby="product-sale-price-help"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-stock">Stock actual</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(event) =>
                    setField("stock", event.target.value, setStock)
                  }
                  placeholder="0"
                  aria-invalid={!!errors.stock}
                />
                <FieldError message={errors.stock} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-min-stock">Stock mínimo</Label>
                <Input
                  id="product-min-stock"
                  type="number"
                  min={0}
                  value={minStock}
                  onChange={(event) =>
                    setField("minStock", event.target.value, setMinStock)
                  }
                  placeholder="0"
                  aria-invalid={!!errors.minStock}
                />
                <FieldError message={errors.minStock} />
              </div>
            </div>

            {submitError && (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(backTo)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Guardar producto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}
