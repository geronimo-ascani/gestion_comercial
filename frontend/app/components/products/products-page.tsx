import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
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
import { Label } from "~/components/ui/label";
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
import { TableSkeleton } from "~/components/ui/skeleton";
import { useDebouncedValue } from "~/lib/use-debounced-value";
import { formatMoney, parseNumberInput } from "~/lib/currency";
import {
  crearCategoria,
  eliminarCategoria,
  eliminarProducto,
  listarCategorias,
  listarProductos,
  type Categoria,
  type StockEstado,
} from "./products-api";
import { refreshProducts } from "./products-store";
import type { Product } from "./products-types";

function formatPercent(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

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
            El producto {product.name} ({product.code}) quedará dado de baja y
            no aparecerá en el listado.
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

function CategoryManagementDialog({
  categories,
  onChanged,
}: {
  categories: Categoria[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Ingrese un nombre para la categoría.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await crearCategoria(normalizedName);
      setName("");
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(category: Categoria) {
    setBusy(true);
    setError(null);
    try {
      await eliminarCategoria(category.id_categoria);
      setDeleteTarget(null);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Tags />
            Categorías
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Administrar categorías</DialogTitle>
          <DialogDescription>
            Solo se pueden eliminar categorías que no tengan productos
            asociados.
          </DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={handleAddCategory}>
          <Input
            aria-label="Nombre de la categoría"
            placeholder="Nueva categoría"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          <Button
            type="submit"
            aria-label="Agregar categoría"
            disabled={busy}
          >
            <Plus />
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="max-h-64 divide-y overflow-y-auto">
          {categories.map((category) => (
            <div
              key={category.id_categoria}
              className="flex min-h-12 items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{category.nombre}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {category.id_categoria}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-destructive hover:text-destructive"
                aria-label={`Eliminar categoría ${category.nombre}`}
                disabled={busy}
                onClick={() => setDeleteTarget(category)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        {deleteTarget && (
          <div className="space-y-3 rounded-md border border-destructive/30 p-3">
            <p className="text-sm">
              ¿Eliminar “{deleteTarget.nombre}”? Esta acción no se puede
              deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => handleDeleteCategory(deleteTarget)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusToFiltro(status: "all" | StockStatus): StockEstado {
  if (status === "ok") return "en_stock";
  if (status === "critical") return "critico";
  if (status === "out") return "sin_stock";
  return "todos";
}

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [status, setStatus] = useState<"all" | StockStatus>("all");
  const debouncedQuery = useDebouncedValue(query);
  const debouncedPriceMin = useDebouncedValue(priceMin);
  const debouncedPriceMax = useDebouncedValue(priceMax);
  const hasFilters =
    query.trim() !== "" ||
    categoryId !== "all" ||
    priceMin.trim() !== "" ||
    priceMax.trim() !== "" ||
    status !== "all";

  useEffect(() => {
    let cancelled = false;

    listarCategorias()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const min = parseNumberInput(debouncedPriceMin);
    const max = parseNumberInput(debouncedPriceMax);

    listarProductos({
      q: debouncedQuery,
      idCategoria: categoryId === "all" ? undefined : categoryId,
      precioMin: min > 0 ? min : undefined,
      precioMax: max > 0 ? max : undefined,
      stockEstado: statusToFiltro(status),
      estado: true,
      limit: 200,
    })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setProducts([]);
        setTotal(0);
        setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedQuery,
    categoryId,
    debouncedPriceMin,
    debouncedPriceMax,
    status,
    reloadKey,
  ]);

  function openNewProduct() {
    navigate("/products/new");
  }

  function reload() {
    setReloadKey((value) => value + 1);
  }

  function handleCategoriesChanged() {
    setCategoryId("all");
    reload();
  }

  async function handleDeleteProduct(product: Product) {
    setError(null);
    try {
      await eliminarProducto(product.id);
      await refreshProducts();
      reload();
    } catch (caught) {
      setError(errorMessage(caught));
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
        <div className="flex gap-2">
          <CategoryManagementDialog
            categories={categories}
            onChanged={handleCategoriesChanged}
          />
          <Button onClick={openNewProduct}>
            <Plus />
            Nuevo producto
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar por nombre, código o descripción..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="category-filter">Categoría</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value ?? "all")}
            >
              <SelectTrigger id="category-filter" className="w-44">
                <SelectValue>
                  {(value) =>
                    categories.find((item) => item.id_categoria === value)
                      ?.nombre ?? "Todos"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item.id_categoria} value={item.id_categoria}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="stock-status-filter">Estado de stock</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as "all" | StockStatus)}
            >
              <SelectTrigger id="stock-status-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">En stock</SelectItem>
                <SelectItem value="critical">Stock crítico</SelectItem>
                <SelectItem value="out">Sin stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Listado de productos</CardTitle>
          </div>
          <Badge variant="secondary">{total} productos</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={9} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Precio venta</TableHead>
                  <TableHead>Alícuota IVA</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {hasFilters
                        ? "No se encontraron resultados."
                        : "No hay productos registrados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">
                        {product.code || "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right">
                        {product.margin != null
                          ? formatPercent(product.margin)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(product.salePrice)}
                      </TableCell>
                      <TableCell>{product.alicuotaDescripcion}</TableCell>
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
                            onClick={() =>
                              navigate(`/products/new?edit=${product.id}`)
                            }
                          >
                            <Pencil />
                          </Button>
                          <ProductDeleteDialog
                            product={product}
                            onConfirm={() => handleDeleteProduct(product)}
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
        <CardFooter className="justify-between text-sm text-muted-foreground" />
      </Card>
    </div>
  );
}
