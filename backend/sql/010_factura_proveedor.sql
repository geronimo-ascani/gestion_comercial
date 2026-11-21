BEGIN;

-- Factura recibida del proveedor. Es un comprobante externo e inmutable:
-- no modifica stock, que sigue ligado a la recepción del pedido de compra.
-- El pedido es un comprobante interno, por eso no condiciona el estado de la
-- factura; solo se usa para saber qué proveedor emitió el documento.

CREATE SEQUENCE IF NOT EXISTS factura_proveedor_id_seq;

CREATE TABLE IF NOT EXISTS factura_proveedor (
    id_factura_proveedor VARCHAR(20) PRIMARY KEY DEFAULT 'FP-' ||
        LPAD(nextval('factura_proveedor_id_seq')::text, 4, '0'),
    fecha_emision TIMESTAMPTZ NOT NULL,
    fecha_vence TIMESTAMPTZ NOT NULL,
    tipo_comprobante VARCHAR(20) NOT NULL
        CHECK (tipo_comprobante IN ('A', 'B', 'C', 'E')),
    punto_venta VARCHAR(5) NOT NULL,
    numero_comprobante VARCHAR(20) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'ARS',
    cotizacion NUMERIC(14,6) NOT NULL DEFAULT 1 CHECK (cotizacion > 0),
    neto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
    iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
    otros_tributos NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (otros_tributos >= 0),
    retenciones NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (retenciones >= 0),
    descuento NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    saldo_pendiente NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
    estado_pago VARCHAR(20) NOT NULL DEFAULT 'emitida'
        CHECK (estado_pago IN ('emitida', 'aprobada', 'pagada')),
    cae VARCHAR(20),
    cae_vence DATE,
    codigo_autorizacion VARCHAR(20),
    tipo_codigo_autorizacion CHAR(1)
        CHECK (tipo_codigo_autorizacion IS NULL OR tipo_codigo_autorizacion IN ('A', 'E')),
    qr TEXT,
    proveedor_razon_social VARCHAR(160) NOT NULL,
    proveedor_cuit VARCHAR(20) NOT NULL,
    proveedor_domicilio VARCHAR(200) NOT NULL DEFAULT '',
    proveedor_condicion_iva VARCHAR(120) NOT NULL,
    empresa_razon_social VARCHAR(160) NOT NULL,
    empresa_cuit VARCHAR(20) NOT NULL,
    empresa_domicilio VARCHAR(200) NOT NULL DEFAULT '',
    empresa_condicion_iva VARCHAR(120) NOT NULL,
    observaciones VARCHAR(500) NOT NULL DEFAULT '',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_empresa VARCHAR(20) NOT NULL REFERENCES empresa(id_empresa) ON DELETE RESTRICT,
    id_proveedor VARCHAR(20) NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    id_pedido_proveedor VARCHAR(20) NOT NULL
        REFERENCES pedido_proveedor(id_pedido_proveedor) ON DELETE RESTRICT,
    id_empleado VARCHAR(20) NOT NULL REFERENCES empleado(id_empleado) ON DELETE RESTRICT,
    CONSTRAINT ck_factura_proveedor_fechas CHECK (fecha_vence >= fecha_emision),
    CONSTRAINT ck_factura_proveedor_saldo CHECK (saldo_pendiente <= total)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_factura_proveedor_numero
    ON factura_proveedor (
        id_empresa, id_proveedor, punto_venta, tipo_comprobante,
        numero_comprobante
    );

CREATE INDEX IF NOT EXISTS ix_factura_proveedor_empresa
    ON factura_proveedor (id_empresa);
CREATE INDEX IF NOT EXISTS ix_factura_proveedor_pedido
    ON factura_proveedor (id_empresa, id_pedido_proveedor);
CREATE INDEX IF NOT EXISTS ix_factura_proveedor_proveedor
    ON factura_proveedor (id_empresa, id_proveedor);
CREATE INDEX IF NOT EXISTS ix_factura_proveedor_fecha
    ON factura_proveedor (id_empresa, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS ix_factura_proveedor_estado
    ON factura_proveedor (id_empresa, estado_pago);

CREATE TABLE IF NOT EXISTS detalle_factura_proveedor (
    id_factura_proveedor VARCHAR(20) NOT NULL
        REFERENCES factura_proveedor(id_factura_proveedor) ON DELETE CASCADE,
    id_producto VARCHAR(20) NOT NULL
        REFERENCES producto(id_producto) ON DELETE RESTRICT,
    id_unidad VARCHAR(20) NOT NULL
        REFERENCES unidad(id_unidad) ON DELETE RESTRICT,
    id_alicuota_iva VARCHAR(20) NOT NULL
        REFERENCES alicuota_iva(id_alicuota_iva) ON DELETE RESTRICT,
    descripcion VARCHAR(255) NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    precio_incluye_iva BOOLEAN NOT NULL,
    descuento_producto NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (descuento_producto >= 0 AND descuento_producto <= 100),
    tipo_iva VARCHAR(20) NOT NULL
        CHECK (tipo_iva IN ('gravado', 'exento', 'no_gravado')),
    alicuota NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (alicuota >= 0),
    neto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
    iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    impuestos_internos NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (impuestos_internos >= 0),
    leyenda VARCHAR(1000) NOT NULL DEFAULT '',
    PRIMARY KEY (id_factura_proveedor, id_producto)
);

CREATE INDEX IF NOT EXISTS ix_detalle_factura_unidad
    ON detalle_factura_proveedor (id_unidad);
CREATE INDEX IF NOT EXISTS ix_detalle_factura_alicuota
    ON detalle_factura_proveedor (id_alicuota_iva);

CREATE TABLE IF NOT EXISTS factura_proveedor_iva (
    id_factura_proveedor VARCHAR(20) NOT NULL
        REFERENCES factura_proveedor(id_factura_proveedor) ON DELETE CASCADE,
    id_alicuota_iva VARCHAR(20) NOT NULL
        REFERENCES alicuota_iva(id_alicuota_iva) ON DELETE RESTRICT,
    tipo_iva VARCHAR(20) NOT NULL
        CHECK (tipo_iva IN ('gravado', 'exento', 'no_gravado')),
    base_imponible NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_imponible >= 0),
    alicuota NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (alicuota >= 0),
    importe_iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (importe_iva >= 0),
    PRIMARY KEY (id_factura_proveedor, id_alicuota_iva, tipo_iva)
);

CREATE TABLE IF NOT EXISTS factura_proveedor_tributo (
    id_tributo BIGSERIAL PRIMARY KEY,
    id_factura_proveedor VARCHAR(20) NOT NULL
        REFERENCES factura_proveedor(id_factura_proveedor) ON DELETE CASCADE,
    tipo_tributo VARCHAR(30) NOT NULL
        CHECK (tipo_tributo IN ('percepcion', 'retencion', 'impuesto_interno')),
    codigo_regimen VARCHAR(20) NOT NULL DEFAULT '',
    descripcion VARCHAR(120) NOT NULL,
    base_imponible NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_imponible >= 0),
    alicuota NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (alicuota >= 0),
    importe NUMERIC(14,2) NOT NULL CHECK (importe >= 0)
);

CREATE INDEX IF NOT EXISTS ix_factura_tributo_factura
    ON factura_proveedor_tributo (id_factura_proveedor);

-- La condición frente al IVA del proveedor permitía conocerse por el pedido,
-- pero se necesita de forma directa para validar la clase del comprobante.
ALTER TABLE proveedor
    ADD COLUMN IF NOT EXISTS id_condicion_iva VARCHAR(20)
        REFERENCES condicion_iva(id_condicion_iva) ON DELETE RESTRICT;

UPDATE proveedor p
SET id_condicion_iva = ci.id_condicion_iva
FROM condicion_iva ci
WHERE p.id_condicion_iva IS NULL
  AND ci.codigo_afip = '5';

-- Los proveedores cargados sin condición explícita quedan como consumidor
-- final; el formulario permite corregirla después.
DO $$
DECLARE
    id_consumidor_final VARCHAR(20);
BEGIN
    SELECT id_condicion_iva INTO id_consumidor_final
    FROM condicion_iva
    WHERE codigo_afip = '5';
    IF id_consumidor_final IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE proveedor ALTER COLUMN id_condicion_iva SET DEFAULT %L',
            id_consumidor_final
        );
    END IF;
END $$;

ALTER TABLE proveedor ALTER COLUMN id_condicion_iva SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_proveedor_condicion_iva
    ON proveedor (id_condicion_iva);

-- Un pago es de venta o de compra, nunca de ambos.
ALTER TABLE pago ALTER COLUMN id_comprobante_venta DROP NOT NULL;
ALTER TABLE pago
    ADD COLUMN IF NOT EXISTS id_factura_proveedor VARCHAR(20)
        REFERENCES factura_proveedor(id_factura_proveedor) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_pago_destino_unico'
    ) THEN
        ALTER TABLE pago
            ADD CONSTRAINT ck_pago_destino_unico CHECK (
                (id_comprobante_venta IS NOT NULL AND id_factura_proveedor IS NULL)
                OR (id_comprobante_venta IS NULL AND id_factura_proveedor IS NOT NULL)
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_pago_factura_proveedor
    ON pago (id_factura_proveedor);

COMMIT;
