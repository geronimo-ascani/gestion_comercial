import { useState, type FormEvent, type ReactElement } from "react";
import { Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

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
import { useInitialLoading } from "~/lib/use-initial-loading";
import { useDebouncedValue } from "~/lib/use-debounced-value";
import { formatMoney, parseNumberInput } from "~/lib/currency";
import {
  ivaConditionLabels,
  type Product,
  UNCATEGORIZED_CATEGORY,
} from "./products-types";
import {
  addCategory,
  removeCategory,
  removeProduct,
  useCategories,
  useProducts,
} from "./products-store";

function formatPercent(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
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

function CategoryManagementDialog({
  categories,
  products,
  onCategoryDeleted,
}: {
  categories: string[];
  products: Product[];
  onCategoryDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addCategory(name)) {
      setError("Ingrese un nombre nuevo para la categoría.");
      return;
    }
    setName("");
    setError(null);
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
            Al eliminar una categoría, sus productos quedan como “Sin categoría”.
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
          <Button type="submit" aria-label="Agregar categoría">
            <Plus />
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="max-h-64 divide-y overflow-y-auto">
          {categories.map((category) => {
            const productCount = products.filter(
              (product) => product.category === category
            ).length;
            const isReserved = category === UNCATEGORIZED_CATEGORY;

            return (
              <div
                key={category}
                className="flex min-h-12 items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{category}</p>
                  <p className="text-xs text-muted-foreground">
                    {productCount} productos
                  </p>
                </div>
                {!isReserved && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    aria-label={`Eliminar categoría ${category}`}
                    onClick={() => setDeleteTarget(category)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {deleteTarget && (
          <div className="space-y-3 rounded-md border border-destructive/30 p-3">
            <p className="text-sm">
              ¿Eliminar “{deleteTarget}”? Los productos asociados pasarán a
              “Sin categoría”.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  removeCategory(deleteTarget);
                  setDeleteTarget(null);
                  onCategoryDeleted();
                }}
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

export function ProductsPage() {
  const navigate = useNavigate();
  const loading = useInitialLoading();
  const products = useProducts();
  const categories = useCategories();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [status, setStatus] = useState<"all" | StockStatus>("all");
  const debouncedQuery = useDebouncedValue(query);

  const filtered = products.filter((product) => {
    const haystack =
      `${product.code} ${product.name} ${product.category} ${product.description}`.toLowerCase();
    const matchesQuery = haystack.includes(debouncedQuery.trim().toLowerCase());
    const matchesCategory = category === "all" || product.category === category;
    const min = parseNumberInput(priceMin);
    const max = parseNumberInput(priceMax);
    const matchesPrice =
      (min === 0 || product.salePrice >= min) &&
      (max === 0 || product.salePrice <= max);
    const matchesStatus = status === "all" || stockStatus(product) === status;
    return matchesQuery && matchesCategory && matchesPrice && matchesStatus;
  });

  function openNewProduct() {
    navigate("/products/new");
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
            products={products}
            onCategoryDeleted={() => setCategory("all")}
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
              items={{ all: "Todas" }}
              value={category}
              onValueChange={(value) => setCategory(value ?? "all")}
            >
              <SelectTrigger id="category-filter" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
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
          <Select
            items={{ all: "Todos" }}
            value={status}
            onValueChange={(value) => setStatus(value as "all" | StockStatus)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
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
            
          </div>
          <Badge variant="secondary">{products.length} productos</Badge>
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
                  <TableHead>Condición IVA</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
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
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right">
                        {product.margin != null
                          ? formatPercent(product.margin)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(product.salePrice)}
                      </TableCell>
                      <TableCell>
                        {product.ivaCondition
                          ? ivaConditionLabels[product.ivaCondition]
                          : "—"}
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
                            onClick={() =>
                              navigate(`/products/new?edit=${product.id}`)
                            }
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
         
        </CardFooter>
      </Card>
    </div>
  );
}