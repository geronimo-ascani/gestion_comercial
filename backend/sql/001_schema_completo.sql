SET client_encoding = 'UTF8';

BEGIN;

CREATE SEQUENCE IF NOT EXISTS categoria_id_seq;
CREATE SEQUENCE IF NOT EXISTS condicion_iva_id_seq;
CREATE SEQUENCE IF NOT EXISTS alicuota_iva_id_seq;
CREATE SEQUENCE IF NOT EXISTS unidad_id_seq;
CREATE SEQUENCE IF NOT EXISTS medio_pago_id_seq;
CREATE SEQUENCE IF NOT EXISTS cliente_id_seq;
CREATE SEQUENCE IF NOT EXISTS proveedor_id_seq;
CREATE SEQUENCE IF NOT EXISTS direccion_id_seq;
CREATE SEQUENCE IF NOT EXISTS empleado_id_seq;
CREATE SEQUENCE IF NOT EXISTS producto_id_seq;
CREATE SEQUENCE IF NOT EXISTS presupuesto_cliente_id_seq;
CREATE SEQUENCE IF NOT EXISTS pedido_cliente_id_seq;
CREATE SEQUENCE IF NOT EXISTS comprobante_venta_id_seq;
CREATE SEQUENCE IF NOT EXISTS pago_id_seq;
CREATE SEQUENCE IF NOT EXISTS pedido_proveedor_id_seq;
CREATE SEQUENCE IF NOT EXISTS movimiento_inventario_id_seq;
CREATE SEQUENCE IF NOT EXISTS log_auditoria_id_seq;

CREATE TABLE IF NOT EXISTS condicion_iva (
    id_condicion_iva VARCHAR(20) PRIMARY KEY DEFAULT 'CIV-' || LPAD(nextval('condicion_iva_id_seq')::text, 4, '0'),
    codigo_afip VARCHAR(10) NOT NULL,
    descripcion VARCHAR(120) NOT NULL,
    CONSTRAINT uq_condicion_iva_codigo_afip UNIQUE (codigo_afip)
);

CREATE TABLE IF NOT EXISTS alicuota_iva (
    id_alicuota_iva VARCHAR(20) PRIMARY KEY DEFAULT 'AIV-' || LPAD(nextval('alicuota_iva_id_seq')::text, 4, '0'),
    codigo_afip VARCHAR(10) NOT NULL,
    descripcion VARCHAR(120) NOT NULL,
    porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    tipo_iva VARCHAR(20) NOT NULL CHECK (tipo_iva IN ('gravado', 'exento', 'no_gravado')),
    CONSTRAINT uq_alicuota_iva_codigo_tipo UNIQUE (codigo_afip, tipo_iva)
);

CREATE TABLE IF NOT EXISTS categoria (
    id_categoria VARCHAR(20) PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL
);

ALTER TABLE categoria
    ALTER COLUMN id_categoria
    SET DEFAULT 'CAT-' || LPAD(nextval('categoria_id_seq')::text, 4, '0');

CREATE UNIQUE INDEX IF NOT EXISTS ux_categoria_nombre_lower
    ON categoria (LOWER(nombre));

CREATE TABLE IF NOT EXISTS unidad (
    id_unidad VARCHAR(20) PRIMARY KEY DEFAULT 'UNI-' || LPAD(nextval('unidad_id_seq')::text, 4, '0'),
    descripcion VARCHAR(80) NOT NULL,
    unidad_venta VARCHAR(10) NOT NULL,
    CONSTRAINT uq_unidad_venta UNIQUE (unidad_venta)
);

CREATE TABLE IF NOT EXISTS medio_pago (
    id_medio_pago VARCHAR(20) PRIMARY KEY DEFAULT 'MPG-' || LPAD(nextval('medio_pago_id_seq')::text, 4, '0'),
    medio_pago VARCHAR(80) NOT NULL,
    tipo_cobro VARCHAR(20) NOT NULL,
    CONSTRAINT uq_medio_pago_nombre UNIQUE (medio_pago)
);

CREATE TABLE IF NOT EXISTS cliente (
    id_cliente VARCHAR(20) PRIMARY KEY DEFAULT 'CLI-' || LPAD(nextval('cliente_id_seq')::text, 4, '0'),
    apellido VARCHAR(120) NOT NULL,
    dni_cuit VARCHAR(20) NOT NULL,
    email VARCHAR(160) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
    telefono VARCHAR(40) NOT NULL,
    id_condicion_iva VARCHAR(20) NOT NULL REFERENCES condicion_iva(id_condicion_iva) ON DELETE RESTRICT,
    CONSTRAINT uq_cliente_dni_cuit UNIQUE (dni_cuit)
);

CREATE TABLE IF NOT EXISTS proveedor (
    id_proveedor VARCHAR(20) PRIMARY KEY DEFAULT 'PRV-' || LPAD(nextval('proveedor_id_seq')::text, 4, '0'),
    banco VARCHAR(120) NOT NULL,
    cuenta VARCHAR(40) NOT NULL,
    cuit VARCHAR(20) NOT NULL,
    email VARCHAR(160) NOT NULL,
    razon_social VARCHAR(160) NOT NULL,
    saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
    telefono VARCHAR(40) NOT NULL,
    CONSTRAINT uq_proveedor_cuit UNIQUE (cuit)
);

CREATE TABLE IF NOT EXISTS direccion (
    id_direccion VARCHAR(20) PRIMARY KEY DEFAULT 'DIR-' || LPAD(nextval('direccion_id_seq')::text, 4, '0'),
    altura VARCHAR(10) NOT NULL,
    calle VARCHAR(160) NOT NULL,
    cp VARCHAR(10) NOT NULL,
    depto VARCHAR(20) NOT NULL DEFAULT '',
    localidad VARCHAR(120) NOT NULL,
    provincia VARCHAR(120) NOT NULL,
    id_cliente VARCHAR(20) REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    id_proveedor VARCHAR(20) REFERENCES proveedor(id_proveedor) ON DELETE CASCADE,
    CONSTRAINT ck_direccion_un_sujeto CHECK (
        (id_cliente IS NOT NULL AND id_proveedor IS NULL)
        OR (id_cliente IS NULL AND id_proveedor IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS empleado (
    id_empleado VARCHAR(20) PRIMARY KEY DEFAULT 'EMP-' || LPAD(nextval('empleado_id_seq')::text, 4, '0'),
    apellido VARCHAR(120) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    dni_cuil VARCHAR(20) NOT NULL,
    email VARCHAR(160) NOT NULL,
    fecha_alta TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_ingreso DATE NOT NULL,
    fecha_modificacion TIMESTAMPTZ,
    nombre VARCHAR(120) NOT NULL,
    puesto VARCHAR(80) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ventas', 'abastecimiento', 'administrador')),
    telefono VARCHAR(40) NOT NULL,
    CONSTRAINT uq_empleado_dni_cuil UNIQUE (dni_cuil),
    CONSTRAINT uq_empleado_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS producto (
    id_producto VARCHAR(20) PRIMARY KEY DEFAULT 'PRD-' || LPAD(nextval('producto_id_seq')::text, 4, '0'),
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    imagen BOOLEAN NOT NULL DEFAULT FALSE,
    margen NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (margen >= 0),
    nombre VARCHAR(160) NOT NULL,
    precio_compra NUMERIC(14,2) NOT NULL CHECK (precio_compra >= 0),
    precio_venta NUMERIC(14,2) NOT NULL CHECK (precio_venta >= 0),
    stock_actual NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    id_alicuota_iva VARCHAR(20) NOT NULL REFERENCES alicuota_iva(id_alicuota_iva) ON DELETE RESTRICT,
    id_categoria VARCHAR(20) NOT NULL REFERENCES categoria(id_categoria) ON DELETE RESTRICT,
    id_unidad VARCHAR(20) NOT NULL REFERENCES unidad(id_unidad) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_producto_categoria ON producto (id_categoria);
CREATE INDEX IF NOT EXISTS ix_producto_alicuota ON producto (id_alicuota_iva);
CREATE INDEX IF NOT EXISTS ix_producto_unidad ON producto (id_unidad);
CREATE INDEX IF NOT EXISTS ix_producto_nombre ON producto (LOWER(nombre));

CREATE TABLE IF NOT EXISTS presupuesto_cliente (
    id_presupuesto_cliente VARCHAR(20) PRIMARY KEY DEFAULT 'PRE-' || LPAD(nextval('presupuesto_cliente_id_seq')::text, 4, '0'),
    descuento_compra NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_compra >= 0 AND descuento_compra <= 100),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('pendiente', 'aprobado', 'vencido', 'convertido')),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_muestra DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    id_cliente VARCHAR(20) NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    CONSTRAINT ck_presupuesto_fechas CHECK (fecha_vencimiento >= fecha_muestra)
);

CREATE INDEX IF NOT EXISTS ix_presupuesto_cliente ON presupuesto_cliente (id_cliente);
CREATE INDEX IF NOT EXISTS ix_presupuesto_estado ON presupuesto_cliente (estado);

CREATE TABLE IF NOT EXISTS detalle_presupuesto_cliente (
    id_presupuesto_cliente VARCHAR(20) NOT NULL REFERENCES presupuesto_cliente(id_presupuesto_cliente) ON DELETE CASCADE,
    id_producto VARCHAR(20) NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    descuento_producto NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_producto >= 0 AND descuento_producto <= 100),
    iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
    neto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tipo_iva VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_presupuesto_cliente, id_producto)
);

CREATE TABLE IF NOT EXISTS pedido_cliente (
    id_pedido_cliente VARCHAR(20) PRIMARY KEY DEFAULT 'PV-' || LPAD(nextval('pedido_cliente_id_seq')::text, 4, '0'),
    descuento_compra NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_compra >= 0 AND descuento_compra <= 100),
    entrega_altura VARCHAR(10) NOT NULL DEFAULT '',
    entrega_calle VARCHAR(160) NOT NULL DEFAULT '',
    entrega_cp VARCHAR(10) NOT NULL DEFAULT '',
    entrega_depto VARCHAR(20) NOT NULL DEFAULT '',
    entrega_localidad VARCHAR(120) NOT NULL DEFAULT '',
    estado_envio VARCHAR(20) NOT NULL CHECK (estado_envio IN ('pendiente', 'proceso', 'enviado', 'entregado', 'cancelado')),
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_muestra DATE NOT NULL DEFAULT CURRENT_DATE,
    saldo_pendiente NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
    total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    id_cliente VARCHAR(20) NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
    id_presupuesto_cliente VARCHAR(20) REFERENCES presupuesto_cliente(id_presupuesto_cliente) ON DELETE SET NULL,
    CONSTRAINT uq_pedido_cliente_presupuesto UNIQUE (id_presupuesto_cliente)
);

CREATE INDEX IF NOT EXISTS ix_pedido_cliente_cliente ON pedido_cliente (id_cliente);
CREATE INDEX IF NOT EXISTS ix_pedido_cliente_estado ON pedido_cliente (estado_envio);
CREATE INDEX IF NOT EXISTS ix_pedido_cliente_fecha ON pedido_cliente (fecha_emision DESC);

CREATE TABLE IF NOT EXISTS detalle_pedido_cliente (
    id_pedido_cliente VARCHAR(20) NOT NULL REFERENCES pedido_cliente(id_pedido_cliente) ON DELETE CASCADE,
    id_producto VARCHAR(20) NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    descuento_producto NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_producto >= 0 AND descuento_producto <= 100),
    iva NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (iva >= 0),
    neto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (neto >= 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tipo_iva VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_pedido_cliente, id_producto)
);

CREATE TABLE IF NOT EXISTS comprobante_venta (
    id_comprobante_venta VARCHAR(20) PRIMARY KEY DEFAULT 'FV-' || LPAD(nextval('comprobante_venta_id_seq')::text, 4, '0'),
    estado_pago VARCHAR(20) NOT NULL CHECK (estado_pago IN ('emitida', 'aprobada', 'pagada', 'rechazada')),
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_pago DATE,
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    tipo_comprobante VARCHAR(2) NOT NULL CHECK (tipo_comprobante IN ('A', 'B', 'C', 'E')),
    id_pedido_cliente VARCHAR(20) NOT NULL REFERENCES pedido_cliente(id_pedido_cliente) ON DELETE RESTRICT,
    CONSTRAINT uq_comprobante_venta_pedido UNIQUE (id_pedido_cliente),
    CONSTRAINT ck_comprobante_venta_fecha_pago CHECK (fecha_pago IS NULL OR fecha_pago >= fecha_emision)
);

COMMENT ON COLUMN comprobante_venta.tipo_comprobante IS
    'Clase ARCA: A (RI a RI o monotributista), B (RI a consumidor final, exento, no responsable o sujeto no categorizado), C (monotributista o exento a cualquier destinatario), E (exportación). Se calcula en el backend según la condición IVA del cliente y la condición del emisor.';

CREATE TABLE IF NOT EXISTS pago (
    id_pago VARCHAR(20) PRIMARY KEY DEFAULT 'PAG-' || LPAD(nextval('pago_id_seq')::text, 4, '0'),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado', 'pendiente', 'rechazado')),
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    referencia VARCHAR(80) NOT NULL DEFAULT '',
    id_comprobante_venta VARCHAR(20) NOT NULL REFERENCES comprobante_venta(id_comprobante_venta) ON DELETE RESTRICT,
    id_medio_pago VARCHAR(20) NOT NULL REFERENCES medio_pago(id_medio_pago) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_pago_comprobante ON pago (id_comprobante_venta);
CREATE INDEX IF NOT EXISTS ix_pago_medio ON pago (id_medio_pago);

CREATE TABLE IF NOT EXISTS pedido_proveedor (
    id_pedido_proveedor VARCHAR(20) PRIMARY KEY DEFAULT 'OC-' || LPAD(nextval('pedido_proveedor_id_seq')::text, 4, '0'),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('pendiente', 'aprobada', 'recibida', 'cancelada')),
    fecha_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_recepcion DATE,
    total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    id_empleado VARCHAR(20) NOT NULL REFERENCES empleado(id_empleado) ON DELETE RESTRICT,
    id_medio_pago VARCHAR(20) NOT NULL REFERENCES medio_pago(id_medio_pago) ON DELETE RESTRICT,
    id_proveedor VARCHAR(20) NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
    CONSTRAINT ck_pedido_proveedor_fechas CHECK (fecha_recepcion IS NULL OR fecha_recepcion >= fecha_pedido)
);

CREATE INDEX IF NOT EXISTS ix_pedido_proveedor_proveedor ON pedido_proveedor (id_proveedor);
CREATE INDEX IF NOT EXISTS ix_pedido_proveedor_empleado ON pedido_proveedor (id_empleado);
CREATE INDEX IF NOT EXISTS ix_pedido_proveedor_medio ON pedido_proveedor (id_medio_pago);
CREATE INDEX IF NOT EXISTS ix_pedido_proveedor_fecha ON pedido_proveedor (fecha_pedido DESC);

CREATE TABLE IF NOT EXISTS detalle_pedido_proveedor (
    id_pedido_proveedor VARCHAR(20) NOT NULL REFERENCES pedido_proveedor(id_pedido_proveedor) ON DELETE CASCADE,
    id_producto VARCHAR(20) NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(14,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    PRIMARY KEY (id_pedido_proveedor, id_producto)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'tipo_movimiento' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'motivo_movimiento' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE motivo_movimiento AS ENUM ('compra', 'venta', 'devolucion', 'ajuste');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id_movimiento VARCHAR(20) PRIMARY KEY DEFAULT 'MOV-' || LPAD(nextval('movimiento_inventario_id_seq')::text, 4, '0'),
    cantidad NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
    motivo motivo_movimiento NOT NULL,
    tipo tipo_movimiento NOT NULL,
    id_pedido_cliente VARCHAR(20) REFERENCES pedido_cliente(id_pedido_cliente) ON DELETE RESTRICT,
    id_pedido_proveedor VARCHAR(20) REFERENCES pedido_proveedor(id_pedido_proveedor) ON DELETE RESTRICT,
    id_producto VARCHAR(20) NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
    CONSTRAINT ck_movimiento_referencia CHECK (
        (motivo = 'compra' AND tipo = 'entrada' AND id_pedido_proveedor IS NOT NULL AND id_pedido_cliente IS NULL)
        OR (motivo = 'venta' AND tipo = 'salida' AND id_pedido_cliente IS NOT NULL AND id_pedido_proveedor IS NULL)
        OR (motivo = 'devolucion' AND (
            (tipo = 'entrada' AND id_pedido_cliente IS NOT NULL AND id_pedido_proveedor IS NULL)
            OR (tipo = 'salida' AND id_pedido_proveedor IS NOT NULL AND id_pedido_cliente IS NULL)
        ))
        OR (motivo = 'ajuste' AND id_pedido_cliente IS NULL AND id_pedido_proveedor IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_movimiento_producto_fecha ON movimiento_inventario (id_producto, fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS ix_movimiento_pedido_cliente ON movimiento_inventario (id_pedido_cliente);
CREATE INDEX IF NOT EXISTS ix_movimiento_pedido_proveedor ON movimiento_inventario (id_pedido_proveedor);
CREATE INDEX IF NOT EXISTS ix_movimiento_fecha ON movimiento_inventario (fecha_movimiento DESC);

CREATE TABLE IF NOT EXISTS log_auditoria (
    id_log VARCHAR(20) PRIMARY KEY DEFAULT 'LOG-' || LPAD(nextval('log_auditoria_id_seq')::text, 4, '0'),
    accion VARCHAR(20) NOT NULL,
    data_anterior TEXT,
    data_nueva TEXT,
    entidad_afectada VARCHAR(40) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_entidad VARCHAR(20) NOT NULL,
    id_empleado VARCHAR(20) NOT NULL REFERENCES empleado(id_empleado) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_log_empleado ON log_auditoria (id_empleado);
CREATE INDEX IF NOT EXISTS ix_log_fecha ON log_auditoria (fecha_hora DESC);
CREATE INDEX IF NOT EXISTS ix_log_entidad ON log_auditoria (entidad_afectada, id_entidad);

INSERT INTO condicion_iva (codigo_afip, descripcion)
VALUES
    ('1', 'IVA Responsable Inscripto'),
    ('3', 'IVA No Responsable'),
    ('4', 'IVA Sujeto Exento'),
    ('5', 'Consumidor Final'),
    ('6', 'Responsable Monotributo'),
    ('7', 'Sujeto No Categorizado')
ON CONFLICT (codigo_afip) DO NOTHING;

INSERT INTO alicuota_iva (codigo_afip, descripcion, porcentaje, tipo_iva)
VALUES
    ('0006', 'IVA 27%', 27.00, 'gravado'),
    ('0005', 'IVA 21%', 21.00, 'gravado'),
    ('0004', 'IVA 10,5%', 10.50, 'gravado'),
    ('0008', 'IVA 5%', 5.00, 'gravado'),
    ('0009', 'IVA 2,5%', 2.50, 'gravado'),
    ('0003', 'Exento', 0.00, 'exento'),
    ('0003', 'No gravado', 0.00, 'no_gravado')
ON CONFLICT (codigo_afip, tipo_iva) DO NOTHING;

INSERT INTO categoria (nombre)
VALUES
    ('Informática'),
    ('Periféricos'),
    ('Almacenamiento'),
    ('Sin categoría')
ON CONFLICT DO NOTHING;

INSERT INTO unidad (descripcion, unidad_venta)
VALUES
    ('Unidad', 'UN'),
    ('Caja', 'CJ'),
    ('Kilogramo', 'KG'),
    ('Litro', 'LT'),
    ('Metro', 'MT'),
    ('Pack', 'PK')
ON CONFLICT (unidad_venta) DO NOTHING;

INSERT INTO medio_pago (medio_pago, tipo_cobro)
VALUES
    ('Efectivo', 'contado'),
    ('Transferencia', 'transferencia'),
    ('Tarjeta', 'tarjeta'),
    ('MercadoPago', 'billetera'),
    ('Cheque', 'cheque')
ON CONFLICT (medio_pago) DO NOTHING;

COMMIT;
