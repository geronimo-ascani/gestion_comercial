BEGIN;

CREATE TABLE IF NOT EXISTS reserva_codigo_producto (
    id_producto VARCHAR(20) PRIMARY KEY,
    estado VARCHAR(12) NOT NULL
        CHECK (estado IN ('reservado', 'usado', 'anulado')),
    fecha_reserva TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_reserva_codigo_producto_estado_fecha
    ON reserva_codigo_producto (estado, fecha_reserva);

COMMIT;
