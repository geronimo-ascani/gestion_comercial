BEGIN;

-- Snapshot inmutable del comprobante emitido. Antes, cabecera, cliente,
-- empresa, entrega, estado e ítems se reconstruían con joins en vivo, por lo
-- que un comprobante ya emitido cambiaba cuando cambiaban esos datos.

ALTER TABLE comprobante_venta
    ADD COLUMN IF NOT EXISTS id_cliente VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_apellido VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_dni_cuit VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_condicion_codigo VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cliente_condicion_descripcion VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_razon_social VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_nombre_fantasia VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_cuit VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_condicion_iva VARCHAR(30) NOT NULL DEFAULT 'responsable_inscripto',
    ADD COLUMN IF NOT EXISTS empresa_domicilio VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_punto_venta VARCHAR(5) NOT NULL DEFAULT '0001',
    ADD COLUMN IF NOT EXISTS empresa_email VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_telefono VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_activa BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS empresa_ingresos_brutos VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_inicio_actividades DATE,
    ADD COLUMN IF NOT EXISTS empresa_codigo_postal VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_localidad VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS empresa_provincia VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS estado_envio VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS descuento_compra NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS entrega_calle VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entrega_altura VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entrega_cp VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entrega_depto VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entrega_localidad VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS entrega_provincia VARCHAR(120) NOT NULL DEFAULT '';

-- Los comprobantes ya emitidos no tenían snapshot. Se rellena con los valores
-- vigentes: es un mejor esfuerzo, porque el valor histórico no existe en la BD.
UPDATE comprobante_venta cv
SET id_cliente = c.id_cliente,
    cliente_nombre = c.nombre,
    cliente_apellido = c.apellido,
    cliente_dni_cuit = c.dni_cuit,
    cliente_email = c.email,
    cliente_telefono = c.telefono,
    cliente_condicion_codigo = ci.codigo_afip,
    cliente_condicion_descripcion = ci.descripcion,
    empresa_razon_social = e.razon_social,
    empresa_nombre_fantasia = e.nombre_fantasia,
    empresa_cuit = e.cuit,
    empresa_condicion_iva = e.condicion_iva,
    empresa_domicilio = e.domicilio,
    empresa_punto_venta = e.punto_venta,
    empresa_email = e.email,
    empresa_telefono = e.telefono,
    empresa_activa = e.activa,
    empresa_ingresos_brutos = e.ingresos_brutos,
    empresa_inicio_actividades = e.inicio_actividades,
    empresa_codigo_postal = e.codigo_postal,
    empresa_localidad = e.localidad,
    empresa_provincia = e.provincia,
    estado_envio = pv.estado_envio,
    descuento_compra = pv.descuento_compra,
    entrega_calle = pv.entrega_calle,
    entrega_altura = pv.entrega_altura,
    entrega_cp = pv.entrega_cp,
    entrega_depto = pv.entrega_depto,
    entrega_localidad = pv.entrega_localidad,
    entrega_provincia = pv.entrega_provincia
FROM empresa e,
     pedido_cliente pv,
     cliente c,
     condicion_iva ci
WHERE cv.id_empresa = e.id_empresa
  AND cv.id_pedido_cliente = pv.id_pedido_cliente
  AND pv.id_cliente = c.id_cliente
  AND c.id_condicion_iva = ci.id_condicion_iva;

CREATE TABLE IF NOT EXISTS comprobante_item (
    id_comprobante_venta VARCHAR(20) NOT NULL
        REFERENCES comprobante_venta(id_comprobante_venta) ON DELETE CASCADE,
    id_producto VARCHAR(20) NOT NULL,
    orden INTEGER NOT NULL CHECK (orden > 0),
    producto_nombre VARCHAR(160) NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    descuento_producto NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (descuento_producto >= 0 AND descuento_producto <= 100),
    iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
    neto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tipo_iva VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_comprobante_venta, id_producto),
    CONSTRAINT uq_comprobante_item_orden UNIQUE (id_comprobante_venta, orden)
);

CREATE INDEX IF NOT EXISTS ix_comprobante_item_comprobante
    ON comprobante_item (id_comprobante_venta);

INSERT INTO comprobante_item (
    id_comprobante_venta,
    id_producto,
    orden,
    producto_nombre,
    cantidad,
    descuento_producto,
    iva,
    neto,
    precio_unitario,
    subtotal,
    tipo_iva
)
SELECT cv.id_comprobante_venta,
       d.id_producto,
       ROW_NUMBER() OVER (
           PARTITION BY cv.id_comprobante_venta
           ORDER BY d.id_producto
       )::INTEGER,
       p.nombre,
       d.cantidad,
       d.descuento_producto,
       d.iva,
       d.neto,
       d.precio_unitario,
       d.subtotal,
       d.tipo_iva
FROM comprobante_venta cv
JOIN detalle_pedido_cliente d
  ON d.id_pedido_cliente = cv.id_pedido_cliente
JOIN producto p ON p.id_producto = d.id_producto
ON CONFLICT (id_comprobante_venta, id_producto) DO NOTHING;

COMMIT;
