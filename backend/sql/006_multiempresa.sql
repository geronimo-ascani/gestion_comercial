BEGIN;

-- Datos contables/fiscales adicionales de la empresa.
ALTER TABLE empresa
    ADD COLUMN IF NOT EXISTS nombre_fantasia VARCHAR(160) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS ingresos_brutos VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS inicio_actividades DATE,
    ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS localidad VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provincia VARCHAR(120) NOT NULL DEFAULT '';

-- El CUIT es único solo cuando está cargado; las empresas placeholder pueden
-- quedar con CUIT vacío hasta que el administrador complete sus datos.
ALTER TABLE empresa DROP CONSTRAINT IF EXISTS uq_empresa_cuit;
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresa_cuit_cargado
    ON empresa (cuit)
    WHERE cuit <> '';

-- Garantizar la empresa inicial a la que se asignan los datos existentes.
INSERT INTO empresa (razon_social, cuit, condicion_iva, domicilio, punto_venta)
SELECT 'Empresa principal', '00000000000', 'responsable_inscripto', '', '0001'
WHERE NOT EXISTS (SELECT 1 FROM empresa);

-- ---------------------------------------------------------------------------
-- Aislamiento por empresa: cada tabla operativa guarda su id_empresa.
-- ---------------------------------------------------------------------------

ALTER TABLE empleado
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE empleado
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE empleado ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE empleado DROP CONSTRAINT IF EXISTS uq_empleado_dni_cuil;
CREATE UNIQUE INDEX IF NOT EXISTS ux_empleado_empresa_dni
    ON empleado (id_empresa, dni_cuil);
CREATE INDEX IF NOT EXISTS ix_empleado_empresa ON empleado (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_empleado_empresa'
    ) THEN
        ALTER TABLE empleado
            ADD CONSTRAINT fk_empleado_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE cliente
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE cliente
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE cliente ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE cliente DROP CONSTRAINT IF EXISTS uq_cliente_dni_cuit;
CREATE UNIQUE INDEX IF NOT EXISTS ux_cliente_empresa_dni
    ON cliente (id_empresa, dni_cuit);
CREATE INDEX IF NOT EXISTS ix_cliente_empresa ON cliente (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cliente_empresa'
    ) THEN
        ALTER TABLE cliente
            ADD CONSTRAINT fk_cliente_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE proveedor
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE proveedor
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE proveedor ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE proveedor DROP CONSTRAINT IF EXISTS uq_proveedor_cuit;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_empresa_cuit
    ON proveedor (id_empresa, cuit);
CREATE INDEX IF NOT EXISTS ix_proveedor_empresa ON proveedor (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_proveedor_empresa'
    ) THEN
        ALTER TABLE proveedor
            ADD CONSTRAINT fk_proveedor_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE categoria
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE categoria
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE categoria ALTER COLUMN id_empresa SET NOT NULL;
DROP INDEX IF EXISTS ux_categoria_nombre_lower;
CREATE UNIQUE INDEX IF NOT EXISTS ux_categoria_empresa_nombre
    ON categoria (id_empresa, LOWER(nombre));
CREATE INDEX IF NOT EXISTS ix_categoria_empresa ON categoria (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_categoria_empresa'
    ) THEN
        ALTER TABLE categoria
            ADD CONSTRAINT fk_categoria_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE medio_pago
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE medio_pago
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE medio_pago ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE medio_pago DROP CONSTRAINT IF EXISTS uq_medio_pago_nombre;
CREATE UNIQUE INDEX IF NOT EXISTS ux_medio_pago_empresa_nombre
    ON medio_pago (id_empresa, medio_pago);
CREATE INDEX IF NOT EXISTS ix_medio_pago_empresa ON medio_pago (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_medio_pago_empresa'
    ) THEN
        ALTER TABLE medio_pago
            ADD CONSTRAINT fk_medio_pago_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE producto
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE producto
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE producto ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_producto_empresa ON producto (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_producto_empresa'
    ) THEN
        ALTER TABLE producto
            ADD CONSTRAINT fk_producto_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE presupuesto_cliente
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE presupuesto_cliente
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE presupuesto_cliente ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_presupuesto_empresa
    ON presupuesto_cliente (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_presupuesto_cliente_empresa'
    ) THEN
        ALTER TABLE presupuesto_cliente
            ADD CONSTRAINT fk_presupuesto_cliente_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE pedido_cliente
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE pedido_cliente
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE pedido_cliente ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pedido_cliente_empresa
    ON pedido_cliente (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pedido_cliente_empresa'
    ) THEN
        ALTER TABLE pedido_cliente
            ADD CONSTRAINT fk_pedido_cliente_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE pago
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE pago
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE pago ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pago_empresa ON pago (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pago_empresa'
    ) THEN
        ALTER TABLE pago
            ADD CONSTRAINT fk_pago_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE pedido_proveedor
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE pedido_proveedor
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE pedido_proveedor ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pedido_proveedor_empresa
    ON pedido_proveedor (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_pedido_proveedor_empresa'
    ) THEN
        ALTER TABLE pedido_proveedor
            ADD CONSTRAINT fk_pedido_proveedor_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE movimiento_inventario
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE movimiento_inventario
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE movimiento_inventario ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_movimiento_empresa
    ON movimiento_inventario (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_movimiento_inventario_empresa'
    ) THEN
        ALTER TABLE movimiento_inventario
            ADD CONSTRAINT fk_movimiento_inventario_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE reserva_codigo_producto
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20);
UPDATE reserva_codigo_producto
SET id_empresa = (SELECT id_empresa FROM empresa ORDER BY id_empresa LIMIT 1)
WHERE id_empresa IS NULL;
ALTER TABLE reserva_codigo_producto ALTER COLUMN id_empresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_reserva_codigo_empresa
    ON reserva_codigo_producto (id_empresa);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_reserva_codigo_producto_empresa'
    ) THEN
        ALTER TABLE reserva_codigo_producto
            ADD CONSTRAINT fk_reserva_codigo_producto_empresa
            FOREIGN KEY (id_empresa) REFERENCES empresa(id_empresa)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- Cada empresa nueva arranca con una categoría y medios de pago propios.
CREATE OR REPLACE FUNCTION sembrar_catalogos_empresa() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categoria (id_empresa, nombre)
    VALUES (NEW.id_empresa, 'Sin categoría')
    ON CONFLICT DO NOTHING;

    INSERT INTO medio_pago (id_empresa, medio_pago, tipo_cobro)
    VALUES
        (NEW.id_empresa, 'Efectivo', 'contado'),
        (NEW.id_empresa, 'Transferencia', 'transferencia'),
        (NEW.id_empresa, 'Tarjeta', 'tarjeta'),
        (NEW.id_empresa, 'MercadoPago', 'billetera'),
        (NEW.id_empresa, 'Cheque', 'cheque')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sembrar_catalogos_empresa ON empresa;
CREATE TRIGGER trg_sembrar_catalogos_empresa
    AFTER INSERT ON empresa
    FOR EACH ROW
    EXECUTE FUNCTION sembrar_catalogos_empresa();

COMMIT;
