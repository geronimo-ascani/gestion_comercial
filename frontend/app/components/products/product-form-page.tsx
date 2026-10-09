import { useState, type FormEvent } from "react";
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
  defaultIvaOperationCode,
  ivaConditionLabels,
  ivaOperationCodeLabels,
  ivaRateLabel,
  ivaRates,
  type IvaCondition,
  type IvaOperationCode,
  type Product,
} from "./products-types";
import { calculateMarginValue, calculateSalePrice } from "./products-calc";
import {
  addProduct,
  getNextProductCode,
  updateProduct,
  useProducts,
} from "./products-store";

function deriveMargin(
  purchasePrice: number,
  salePrice: number,
  ivaRate: number
): number {
  if (purchasePrice <= 0) return 0;
  return (
    Math.round((salePrice / (purchasePrice * (1 + ivaRate)) - 1) * 1000) / 10
  );
}

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
  const [margin, setMargin] = useState(
    editing
      ? String(
          editing.margin ??
            deriveMargin(
              editing.purchasePrice,
              editing.salePrice,
              editing.ivaCondition ? ivaRates[editing.ivaCondition] : 0
            )
        )
      : ""
  );
  const [ivaCondition, setIvaCondition] = useState<IvaCondition>(
    editing?.ivaCondition ?? "gravado21"
  );
  const [operationCode, setOperationCode] = useState<IvaOperationCode>(
    editing?.ivaOperationCode ??
      defaultIvaOperationCode[editing?.ivaCondition ?? "gravado21"] ??
      "E"
  );
  const [stock, setStock] = useState(editing ? String(editing.stock) : "");
  const [minStock, setMinStock] = useState(
    editing ? String(editing.minStock) : ""
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const purchaseAmount = parseNumberInput(purchasePrice);
  const marginAmount = margin.trim() === "" ? 0 : parsePercentInput(margin);
  const ivaRate = ivaRates[ivaCondition];
  const priceValid =
    purchaseAmount > 0 && Number.isFinite(marginAmount) && marginAmount >= 0;
  const marginValueDisplay = priceValid
    ? formatMoney(calculateMarginValue(purchaseAmount, marginAmount))
    : "";
  const salePriceDisplay = priceValid
    ? formatMoney(calculateSalePrice(purchaseAmount, marginAmount, ivaRate))
    : "";

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleIvaChange(value: IvaCondition) {
    setIvaCondition(value);
    setOperationCode(defaultIvaOperationCode[value] ?? "E");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre"),
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
    if (Object.values(next).some((error) => error)) return;
    const product: Product = {
      id: editing?.id ?? crypto.randomUUID(),
      code,
      name: name.trim(),
      description: description.trim(),
      purchasePrice: purchaseAmount,
      margin: marginAmount,
      salePrice: calculateSalePrice(purchaseAmount, marginAmount, ivaRate),
      stock: Math.floor(parseNumberInput(stock)),
      minStock: Math.floor(parseNumberInput(minStock)),
      ivaCondition,
      ivaOperationCode:
        ivaRates[ivaCondition] === 0 ? operationCode : undefined,
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
                <Label htmlFor="product-iva-condition">Condición de IVA</Label>
                <Select
                  value={ivaCondition}
                  onValueChange={(value) => handleIvaChange(value as IvaCondition)}
                >
                  <SelectTrigger id="product-iva-condition" className="w-full">
                    <SelectValue>
                      {(value) =>
                        value
                          ? ivaRateLabel(value as IvaCondition)
                          : "Seleccionar condición"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ivaConditionLabels) as IvaCondition[]).map(
                      (condition) => (
                        <SelectItem
                          key={condition}
                          value={condition}
                          label={ivaConditionLabels[condition]}
                        >
                          {ivaConditionLabels[condition]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                
              </div>
            </div>

            {ivaRates[ivaCondition] === 0 && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="product-operation-code">
                  Código de operación (ARCA)
                </Label>
                <Select
                  value={operationCode}
                  onValueChange={(value) =>
                    setOperationCode(value as IvaOperationCode)
                  }
                >
                  <SelectTrigger id="product-operation-code" className="w-full">
                    <SelectValue>
                      {(value) =>
                        value
                          ? `${value} · ${ivaOperationCodeLabels[value as IvaOperationCode]}`
                          : "Seleccionar código"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ivaOperationCodeLabels) as IvaOperationCode[]).map(
                      (code) => (
                        <SelectItem
                          key={code}
                          value={code}
                          label={`${code} · ${ivaOperationCodeLabels[code]}`}
                        >
                          {code} · {ivaOperationCodeLabels[code]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                
              </div>
            )}

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