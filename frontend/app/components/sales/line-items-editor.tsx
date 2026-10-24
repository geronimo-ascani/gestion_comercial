import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Combobox } from "~/components/ui/combobox";

import { formatMoney, parseNumberInput, parsePercentInput } from "~/lib/currency";
import type { Product } from "../products/products-types";
import type { LineItem } from "./sales-types";

export type PriceMode = "sale" | "purchase";

interface EditorLine {
  productId: string;
  productName: string;
  qty: string;
  price: string;
  discount: string;
}

function computeLine(line: EditorLine) {
  const qty = Math.max(1, Math.floor(parseNumberInput(line.qty)));
  const price = parseNumberInput(line.price);
  const gross = qty * price;
  const discountPercent = Math.min(
    Math.max(parsePercentInput(line.discount), 0),
    100
  );
  const discountAmount =
    Math.round(gross * (discountPercent / 100) * 100) / 100;
  const net = Math.round((gross - discountAmount) * 100) / 100;
  return { qty, price, gross, discountPercent, discountAmount, net };
}

interface LineItemsEditorProps {
  products: Product[];
  priceMode: PriceMode;
  onChange: (items: LineItem[], total: string) => void;
  initialItems?: LineItem[];
  summaryLabel?: string;
  /** Habilita el descuento porcentual por línea (ventas). */
  allowLineDiscount?: boolean;
}

export function LineItemsEditor({
  products,
  priceMode,
  onChange,
  initialItems = [],
  summaryLabel = "Total",
  allowLineDiscount = false,
}: LineItemsEditorProps) {
  const [lines, setLines] = useState<EditorLine[]>(() =>
    initialItems.map((item) => ({
      productId:
        products.find((product) => product.code === item.sku)?.id ?? "",
      productName: item.product,
      qty: String(item.qty),
      price: String(parseNumberInput(item.unitPrice)),
      discount: item.discount ? String(parsePercentInput(item.discount)) : "0",
    }))
  );

  useEffect(() => {
    const items: LineItem[] = lines
      .filter((line) => {
        const qty = Math.max(1, Math.floor(parseNumberInput(line.qty)));
        return line.productId && qty >= 1;
      })
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        const { qty, price, discountPercent, discountAmount, net } =
          computeLine(line);
        return {
          sku: product?.code,
          product: line.productName,
          qty,
          unitPrice: formatMoney(price),
          discount: discountPercent > 0 ? `${discountPercent}%` : undefined,
          discountAmount:
            discountAmount > 0 ? formatMoney(discountAmount) : undefined,
          subtotal: formatMoney(net),
        };
      });
    const total = lines.reduce((sum, line) => sum + computeLine(line).net, 0);
    onChange(items, formatMoney(total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const total = useMemo(() => {
    return lines.reduce((sum, line) => sum + computeLine(line).net, 0);
  }, [lines]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { productId: "", productName: "", qty: "1", price: "", discount: "0" },
    ]);
  }

  function updateLine(index: number, patch: Partial<EditorLine>) {
    setLines((prev) =>
      prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      )
    );
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    updateLine(index, {
      productId,
      productName: product.name,
      price: String(
        priceMode === "sale" ? product.salePrice : product.purchasePrice
      ),
    });
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Productos</Label>
        <Button
          type="button"
          size="sm"
          disabled={products.length === 0}
          onClick={addLine}
        >
          <Plus />
          Agregar producto
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border p-3 text-center text-sm text-muted-foreground">
          No hay productos cargados. Créelos desde la página Productos.
        </p>
      ) : lines.length === 0 ? (
        <p className="rounded-lg border p-3 text-center text-sm text-muted-foreground">
          Sin productos cargados.
        </p>
      ) : (
        <div className="space-y-2">
          {allowLineDiscount && (
            <div className="hidden items-center gap-2 px-2 text-xs font-medium text-muted-foreground sm:flex">
              <span className="min-w-0 flex-1">Producto</span>
              <span className="w-20 text-center">Cantidad</span>
              <span className="w-28 text-center">P. unitario</span>
              <span className="w-20 text-center">Desc. %</span>
              <span className="w-28 text-right">Subtotal</span>
              <span className="w-8" />
            </div>
          )}
          {lines.map((line, index) => {
            const usedIds = lines
              .filter((_, lineIndex) => lineIndex !== index)
              .map((item) => item.productId)
              .filter(Boolean);
            const available = products.filter(
              (product) => !usedIds.includes(product.id)
            );
            const { qty, discountAmount, net } = computeLine(line);
            const rawDiscount = parsePercentInput(line.discount);
            const invalidDiscount =
              allowLineDiscount && (rawDiscount < 0 || rawDiscount > 100);
            const selectedProduct = products.find(
              (product) => product.id === line.productId
            );
            const insufficient = selectedProduct
              ? qty > selectedProduct.stock
              : false;
            return (
              <div
                key={index}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center",
                  (insufficient || invalidDiscount) && "border-destructive"
                )}
              >
                <Combobox
                  value={line.productId || ""}
                  onValueChange={(productId) => selectProduct(index, productId)}
                  options={available.map((product) => ({
                    value: product.id,
                    label: product.name,
                    description: product.code,
                    keywords: [product.code, product.description],
                  }))}
                  placeholder="Buscar producto…"
                  searchPlaceholder="Buscar por nombre o código..."
                  notFoundText="No se encontraron productos"
                  emptyText="No hay más productos disponibles"
                  className="w-full sm:min-w-0 sm:flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(event) =>
                    updateLine(index, { qty: event.target.value })
                  }
                  className="w-full sm:w-20"
                  aria-label={`Cantidad de ${line.productName || "producto"}`}
                />
                <Input
                  inputMode="decimal"
                  value={line.price}
                  onChange={(event) =>
                    updateLine(index, { price: event.target.value })
                  }
                  placeholder="$ 0"
                  className="w-full sm:w-28"
                  aria-label="Precio unitario"
                />
                {allowLineDiscount && (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={line.discount}
                    onChange={(event) =>
                      updateLine(index, { discount: event.target.value })
                    }
                    placeholder="0"
                    className="w-full sm:w-20"
                    aria-label={`Descuento de ${line.productName || "producto"} (%)`}
                    aria-invalid={invalidDiscount}
                  />
                )}
                <span className="w-full text-right text-sm font-semibold tabular-nums sm:w-28">
                  {formatMoney(net)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Quitar ${line.productName || "producto"}`}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 />
                </Button>
                {(selectedProduct || discountAmount > 0 || invalidDiscount) && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      insufficient || invalidDiscount
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {selectedProduct && (
                      <>
                        Stock: {selectedProduct.stock}
                        {insufficient &&
                          ` · Cantidad excede el stock disponible`}
                      </>
                    )}
                    {selectedProduct &&
                      (discountAmount > 0 || invalidDiscount) &&
                      " · "}
                    {discountAmount > 0 &&
                      `Descuento: − ${formatMoney(discountAmount)}`}
                    {discountAmount > 0 && invalidDiscount && " · "}
                    {invalidDiscount && "Descuento entre 0 y 100%"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-sm text-muted-foreground">{summaryLabel}</span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMoney(total)}
        </span>
      </div>
    </div>
  );
}