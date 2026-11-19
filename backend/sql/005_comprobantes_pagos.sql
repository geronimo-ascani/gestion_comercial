BEGIN;

CREATE SEQUENCE IF NOT EXISTS empresa_id_seq;

CREATE TABLE IF NOT EXISTS empresa (
    id_empresa VARCHAR(20) PRIMARY KEY DEFAULT 'EMP-' ||
        LPAD(nextval('empresa_id_seq')::text, 4, '0'),
    razon_social VARCHAR(160) NOT NULL,
    cuit VARCHAR(20) NOT NULL DEFAULT '',
    condicion_iva VARCHAR(30) NOT NULL
        CHECK (condicion_iva IN ('responsable_inscripto', 'monotributista', 'exento')),
    domicilio VARCHAR(200) NOT NULL DEFAULT '',
    punto_venta VARCHAR(5) NOT NULL DEFAULT '0001',
    email VARCHAR(160) NOT NULL DEFAULT '',
    telefono VARCHAR(40) NOT NULL DEFAULT '',
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_empresa_cuit UNIQUE (cuit)
);

-- Empresa emisora inicial. Reemplazar por los datos fiscales reales.
INSERT INTO empresa (razon_social, cuit, condicion_iva, domicilio, punto_venta)
SELECT 'Empresa principal', '00000000000', 'responsable_inscripto', '', '0001'
WHERE NOT EXISTS (SELECT 1 FROM empresa);

ALTER TABLE comprobante_venta
    ADD COLUMN IF NOT EXISTS numero_comprobante VARCHAR(20),
    ADD COLUMN IF NOT EXISTS punto_venta VARCHAR(5) NOT NULL DEFAULT '0001',
    ADD COLUMN IF NOT EXISTS cae VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cae_vence DATE,
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20)
        REFERENCES empresa(id_empresa) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS id_empleado VARCHAR(20)
        REFERENCES empleado(id_empleado) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS observaciones VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (saldo_pendiente >= 0),
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE comprobante_venta
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;

UPDATE comprobante_venta
SET saldo_pendiente = monto
WHERE saldo_pendiente = 0 AND monto > 0;

ALTER TABLE comprobante_venta
    ALTER COLUMN id_empresa SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_venta_numero
    ON comprobante_venta (id_empresa, punto_venta, tipo_comprobante, numero_comprobante)
    WHERE numero_comprobante IS NOT NULL;

CREATE TABLE IF NOT EXISTS comprobante_secuencia (
    id_empresa VARCHAR(20) NOT NULL
        REFERENCES empresa(id_empresa) ON DELETE CASCADE,
    punto_venta VARCHAR(5) NOT NULL,
    tipo_comprobante VARCHAR(2) NOT NULL
        CHECK (tipo_comprobante IN ('A', 'B', 'C', 'E')),
    ultimo BIGINT NOT NULL DEFAULT 0 CHECK (ultimo >= 0),
    PRIMARY KEY (id_empresa, punto_venta, tipo_comprobante)
);

CREATE TABLE IF NOT EXISTS comprobante_envio (
    id_envio BIGSERIAL PRIMARY KEY,
    id_comprobante_venta VARCHAR(20) NOT NULL
        REFERENCES comprobante_venta(id_comprobante_venta) ON DELETE CASCADE,
    destinatario VARCHAR(160) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('enviado', 'fallido')),
    error VARCHAR(500),
    enviado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_comprobante_envio_comprobante
    ON comprobante_envio (id_comprobante_venta);

ALTER TABLE pago
    ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_comprobante_venta_empresa
    ON comprobante_venta (id_empresa);
CREATE INDEX IF NOT EXISTS ix_comprobante_venta_estado
    ON comprobante_venta (estado_pago);
CREATE INDEX IF NOT EXISTS ix_comprobante_venta_fecha
    ON comprobante_venta (fecha_emision DESC);

COMMIT;
