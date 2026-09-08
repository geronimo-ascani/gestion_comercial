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

const sampleProducts: ProductRow[] = [
  {
    code: "PRD-001",
    name: "Teclado mecánico RGB",
    description: "Teclado mecánico retroiluminado con switches red.",
    purchasePrice: "$45.000",
    salePrice: "$72.500",
    stock: 24,
    minStock: 10,
  },
  {
    code: "PRD-002",
    name: "Mouse inalámbrico ergonómico",
    description: "Mouse inalámbrico con sensor óptico de 2400 DPI.",
    purchasePrice: "$12.000",
    salePrice: "$19.900",
    stock: 8,
    minStock: 15,
  },
  {
    code: "PRD-003",
    name: "Monitor 24' Full HD",
    description: "Monitor IPS de 23,8 pulgadas con resolución Full HD.",
    purchasePrice: "$180.000",
    salePrice: "$249.000",
    stock: 0,
    minStock: 5,
  },
  {
    code: "PRD-004",
    name: "Auriculares con cancelación de ruido",
    description: "Auriculares over-ear con Bluetooth 5.3.",
    purchasePrice: "$95.000",
    salePrice: "$149.999",
    stock: 12,
    minStock: 6,
  },
  {
    code: "PRD-005",
    name: "Disco sólido SSD 1TB",
    description: "SSD NVMe M.2 con velocidad de lectura de 3500 MB/s.",
    purchasePrice: "$88.000",
    salePrice: "$119.000",
    stock: 5,
    minStock: 8,
  },
  {
    code: "PRD-006",
    name: "Webcam Full HD 1080p",
    description: "Cámara web con micrófono integrado y ajuste de inclinación.",
    purchasePrice: "$32.000",
    salePrice: "$48.500",
    stock: 40,
    minStock: 12,
  },
];

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
              {sampleProducts.length} productos registrados en el catálogo.
            </CardDescription>
          </div>
          <Badge variant="secondary">{sampleProducts.length} productos</Badge>
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
              {sampleProducts.map((product) => (
                <TableRow key={product.code}>
                  <TableCell className="font-mono text-xs">
                    {product.code}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.purchasePrice}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {product.salePrice}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        stockStatus(product) === "out" ||
                        stockStatus(product) === "critical"
                          ? "font-medium text-red-500"
                          : undefined
                      }
                    >
                      {product.stock}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StockBadge product={product} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ProductFormDialog
                        title="Editar producto"
                        description="Modifique los datos del producto y guarde los cambios."
                        product={product}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${product.name}`}
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      <ProductDeleteDialog
                        product={product}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Eliminar ${product.name}`}
                          >
                            <Trash2 />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {sampleProducts.length} productos</span>
        </CardFooter>
      </Card>
    </div>
  );
}