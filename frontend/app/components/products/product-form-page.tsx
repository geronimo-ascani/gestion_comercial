import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import { Textarea } from "~/components/ui/textarea";
import { FormPage } from "~/components/ui/form-page";

import { formatMoney, parseNumberInput } from "~/lib/currency";
import { requireText } from "~/lib/validation";
import type { Product } from "./products-types";
import {
  addProduct,
  getNextProductCode,
  updateProduct,
  useProducts,
} from "./products-store";

export function ProductFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const products = useProducts();
  const editId = searchParams.get("edit");
  const editing = editId
    ? (products.find((product) => product.id === editId) ?? null)
    : null;
  const code = editing?.code ?? getNextProductCode();
  const backTo = "/products";

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    editing ? String(editing.purchasePrice) : ""
  );
  const [salePrice, setSalePrice] = useState(
    editing ? String(editing.salePrice) : ""
  );
  const [stock, setStock] = useState(editing ? String(editing.stock) : "");
  const [minStock, setMinStock] = useState(
    editing ? String(editing.minStock) : ""
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre"),
      purchasePrice:
        purchasePrice.trim() === ""
          ? "El precio de compra es obligatorio"
          : parseNumberInput(purchasePrice) <= 0
            ? "El precio de compra debe ser mayor que 0"
            : null,
      salePrice:
        salePrice.trim() === ""
          ? "El precio de venta es obligatorio"
          : parseNumberInput(salePrice) <= 0
            ? "El precio de venta debe ser mayor que 0"
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
    if (Object.values(next).some((error) => error)) return;
    const product: Product = {
      id: editing?.id ?? crypto.randomUUID(),
      code,
      name: name.trim(),
      description: description.trim(),
      purchasePrice: parseNumberInput(purchasePrice),
      salePrice: parseNumberInput(salePrice),
      stock: Math.floor(parseNumberInput(stock)),
      minStock: Math.floor(parseNumberInput(minStock)),
    };
    if (editing) {
      updateProduct(product.id, product);
    } else {
      addProduct(product);
    }
    navigate(backTo);
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
                  value={code}
                  disabled
                  className="font-mono text-xs"
                  aria-describedby="product-code-help"
                />
                <p
                  id="product-code-help"
                  className="text-xs text-muted-foreground"
                >
                  Se genera automáticamente.
                </p>
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
                <Label htmlFor="product-sale-price">Precio de venta</Label>
                <Input
                  id="product-sale-price"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(event) =>
                    setField("salePrice", event.target.value, setSalePrice)
                  }
                  placeholder="$ 0"
                  aria-invalid={!!errors.salePrice}
                />
                <FieldError message={errors.salePrice} />
              </div>
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

            {editing && (
              <p className="mt-4 text-sm text-muted-foreground">
                Precio de compra actual: {formatMoney(editing.purchasePrice)}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editing ? "Guardar cambios" : "Guardar producto"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormPage>
  );
}