import { type ReactElement } from "react";
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

interface ProductRow {
  code: string;
  name: string;
  description: string;
  purchasePrice: string;
  salePrice: string;
  stock: number;
  minStock: number;
}

type StockStatus = "ok" | "critical" | "out";

function stockStatus(product: ProductRow): StockStatus {
  if (product.stock === 0) return "out";
  if (product.stock <= product.minStock) return "critical";
  return "ok";
}

function StockBadge({ product }: { product: ProductRow }) {
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
  title,
  description,
  product,
  trigger,
}: {
  title: string;
  description: string;
  product?: ProductRow;
  trigger: ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
              defaultValue={product?.name}
              placeholder="Nombre del producto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Descripción</Label>
            <Textarea
              id="product-description"
              defaultValue={product?.description}
              placeholder="Descripción breve del producto"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-purchase-price">Precio de compra</Label>
              <Input
                id="product-purchase-price"
                defaultValue={product?.purchasePrice}
                placeholder="$ 0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sale-price">Precio de venta</Label>
              <Input
                id="product-sale-price"
                defaultValue={product?.salePrice}
                placeholder="$ 0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-stock">Stock actual</Label>
              <Input
                id="product-stock"
                defaultValue={product?.stock}
                type="number"
                min={0}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-min-stock">Stock mínimo</Label>
              <Input
                id="product-min-stock"
                defaultValue={product?.minStock}
                type="number"
                min={0}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar producto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDeleteDialog({
  product,
  trigger,
}: {
  product: ProductRow;
  trigger: ReactElement;
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
          <Button variant="destructive">Eliminar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground">
            Catálogo de productos con stock y precios.
          </p>
        </div>
        <ProductFormDialog
          title="Nuevo producto"
          description="Complete los datos del producto para agregarlo al catálogo."
          trigger={
            <Button>
              <Plus />
              Nuevo producto
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nombre o código..."
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-max">Precio máximo</Label>
            <Input
              id="price-max"
              className="w-28"
              placeholder="$ Max"
              inputMode="numeric"
            />
          </div>
          <Select defaultValue="all">
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
          <Button variant="outline">Buscar</Button>
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
          <Badge variant="secondary">0 productos</Badge>
        </CardHeader>
        <CardContent>
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
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay productos registrados.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Sin productos para mostrar</span>
        </CardFooter>
      </Card>
    </div>
  );
}