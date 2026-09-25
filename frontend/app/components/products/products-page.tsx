import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
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
import { Textarea } from "~/components/ui/textarea";
import { TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import { formatMoney, parseNumberInput } from "~/lib/currency";
import { requireText } from "~/lib/validation";
import type { Product } from "./products-types";
import {
  addProduct,
  removeProduct,
  updateProduct,
  useProducts,
} from "./products-store";

type StockStatus = "ok" | "critical" | "out";

function stockStatus(product: Product): StockStatus {
  if (product.stock === 0) return "out";
  if (product.stock <= product.minStock) return "critical";
  return "ok";
}

function StockBadge({ product }: { product: Product }) {
  const status = stockStatus(product);

  if (status === "out") {
    return <Badge variant="destructive">Sin stock</Badge>;
  }
  if (status === "critical") {
    return <Badge variant="warning">Stock crítico</Badge>;
  }
  return <Badge variant="success">En stock</Badge>;
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSaved: (product: Product) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (open) {
      setCode(product?.code ?? "");
      setName(product?.name ?? "");
      setDescription(product?.description ?? "");
      setPurchasePrice(product ? String(product.purchasePrice) : "");
      setSalePrice(product ? String(product.salePrice) : "");
      setStock(product ? String(product.stock) : "");
      setMinStock(product ? String(product.minStock) : "");
      setErrors({});
    }
  }, [open, product]);

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre"),
      purchasePrice:
        parseNumberInput(purchasePrice) < 0
          ? "El precio de compra no puede ser negativo"
          : null,
      salePrice:
        parseNumberInput(salePrice) < 0
          ? "El precio de venta no puede ser negativo"
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
    onSaved({
      id: product?.id ?? crypto.randomUUID(),
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      purchasePrice: parseNumberInput(purchasePrice),
      salePrice: parseNumberInput(salePrice),
      stock: Math.floor(parseNumberInput(stock)),
      minStock: Math.floor(parseNumberInput(minStock)),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del producto para agregarlo al catálogo.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-code">Código</Label>
              <Input
                id="product-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="PRD-000"
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

          <div className="space-y-2">
            <Label htmlFor="product-description">Descripción</Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción breve del producto"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="grid gap-4 sm:grid-cols-2">
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

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">
              {product ? "Guardar cambios" : "Guardar producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDeleteDialog({
  product,
  trigger,
  onConfirm,
}: {
  product: Product;
  trigger: ReactElement;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar producto?</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se eliminará {product.name} (
            {product.code}).
          </DialogDescription>
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

export function ProductsPage() {
  const loading = useInitialLoading();
  const products = useProducts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [status, setStatus] = useState<"all" | StockStatus>("all");

  const filtered = products.filter((product) => {
    const haystack =
      `${product.code} ${product.name} ${product.description}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const min = parseNumberInput(priceMin);
    const max = parseNumberInput(priceMax);
    const matchesPrice =
      (min === 0 || product.salePrice >= min) &&
      (max === 0 || product.salePrice <= max);
    const matchesStatus = status === "all" || stockStatus(product) === status;
    return matchesQuery && matchesPrice && matchesStatus;
  });

  function openNewProduct() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function handleSaved(product: Product) {
    if (editingProduct) {
      updateProduct(product.id, product);
    } else {
      addProduct({
        ...product,
        code:
          product.code ||
          `PRD-${String(products.length + 1).padStart(3, "0")}`,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground">
            Catálogo de productos con stock y precios.
          </p>
        </div>
        <Button onClick={openNewProduct}>
          <Plus />
          Nuevo producto
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre, código o descripción..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="price-min">Precio mínimo</Label>
            <Input
              id="price-min"
              className="w-28"
              placeholder="$ Min"
              inputMode="numeric"
              value={priceMin}
              onChange={(event) => setPriceMin(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-max">Precio máximo</Label>
            <Input
              id="price-max"
              className="w-28"
              placeholder="$ Max"
              inputMode="numeric"
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "all" | StockStatus)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="in">En stock</SelectItem>
              <SelectItem value="critical">Stock crítico</SelectItem>
              <SelectItem value="out">Sin stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Listado de productos</CardTitle>
            <CardDescription>
              Los productos se cargan desde la base de datos.
            </CardDescription>
          </div>
          <Badge variant="secondary">{products.length} productos</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Precio compra</TableHead>
                  <TableHead className="text-right">Precio venta</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
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
                      {products.length === 0
                        ? "No hay productos registrados."
                        : "No se encontraron resultados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">
                        {product.code || "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(product.purchasePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(product.salePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stock}
                      </TableCell>
                      <TableCell>
                        <StockBadge product={product} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar producto ${product.name}`}
                            onClick={() => {
                              setEditingProduct(product);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <ProductDeleteDialog
                            product={product}
                            onConfirm={() => removeProduct(product.id)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Eliminar producto ${product.name}`}
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
          <span>Mostrando {filtered.length} productos</span>
        </CardFooter>
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSaved={handleSaved}
      />
    </div>
  );
}