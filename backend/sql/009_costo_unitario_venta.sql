BEGIN;

-- El costo de ventas debe quedar congelado al momento de la venta. Antes se
-- leía producto.precio_compra en vivo, por lo que un cambio de costo alteraba
-- las métricas de pedidos ya emitidos.

ALTER TABLE detalle_pedido_cliente
    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (costo_unitario >= 0);

-- Backfill best effort: el costo histórico real no existe en la base. El
-- filtro evita sobrescribir costos ya snapshotados si la migración se reejecuta.
UPDATE detalle_pedido_cliente d
SET costo_unitario = p.precio_compra
FROM producto p
WHERE d.id_producto = p.id_producto
  AND d.costo_unitario = 0;

COMMIT;
