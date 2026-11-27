-- RF-15 / RF-30: correo automático y asíncrono con outbox durable.

ALTER TABLE comprobante_envio
    DROP CONSTRAINT IF EXISTS comprobante_envio_estado_check;

ALTER TABLE comprobante_envio
    ADD CONSTRAINT comprobante_envio_estado_check
    CHECK (estado IN ('pendiente', 'enviado', 'fallido'));

ALTER TABLE comprobante_envio
    ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS id_cola_email BIGINT;

ALTER TABLE comprobante_envio
    DROP CONSTRAINT IF EXISTS comprobante_envio_origen_check;

ALTER TABLE comprobante_envio
    ADD CONSTRAINT comprobante_envio_origen_check
    CHECK (origen IN ('automatico', 'manual'));

CREATE TABLE IF NOT EXISTS email_cola (
    id_cola_email BIGSERIAL PRIMARY KEY,
    id_empresa VARCHAR(20) NOT NULL REFERENCES empresa(id_empresa),
    tipo VARCHAR(40) NOT NULL,
    id_referencia VARCHAR(40),
    id_envio BIGINT,
    destinatario VARCHAR(160) NOT NULL,
    cc TEXT[] NOT NULL DEFAULT '{}',
    bcc TEXT[] NOT NULL DEFAULT '{}',
    asunto VARCHAR(300) NOT NULL,
    cuerpo TEXT NOT NULL,
    cuerpo_html TEXT,
    adjunto_nombre VARCHAR(160),
    adjunto_contenido BYTEA,
    adjunto_tipo_mime VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    reply_to VARCHAR(160),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_proceso', 'enviado', 'fallido')),
    origen VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (origen IN ('automatico', 'manual')),
    intentos SMALLINT NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    max_intentos SMALLINT NOT NULL DEFAULT 3 CHECK (max_intentos > 0),
    proximo_intento TIMESTAMPTZ NOT NULL DEFAULT now(),
    reclamado_en TIMESTAMPTZ,
    ultimo_error VARCHAR(500),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_email_cola_pendientes
    ON email_cola (proximo_intento)
    WHERE estado = 'pendiente';

CREATE UNIQUE INDEX IF NOT EXISTS ux_email_cola_automatico
    ON email_cola (tipo, id_referencia, destinatario)
    WHERE origen = 'automatico' AND id_referencia IS NOT NULL;
