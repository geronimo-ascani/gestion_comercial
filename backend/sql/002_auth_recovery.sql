BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_empleado_email_lower
    ON empleado (LOWER(email));

CREATE TABLE IF NOT EXISTS recuperacion_contrasena (
    token_hash CHAR(64) PRIMARY KEY,
    id_empleado VARCHAR(20) NOT NULL
        REFERENCES empleado(id_empleado) ON DELETE CASCADE,
    vence_en TIMESTAMPTZ NOT NULL,
    consumido_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_recuperacion_empleado
    ON recuperacion_contrasena (id_empleado, vence_en DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limit (
    bucket_hash CHAR(64) PRIMARY KEY,
    inicio_ventana TIMESTAMPTZ NOT NULL,
    intentos INTEGER NOT NULL CHECK (intentos > 0)
);

CREATE INDEX IF NOT EXISTS ix_auth_rate_limit_window
    ON auth_rate_limit (inicio_ventana);

COMMIT;
