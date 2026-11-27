-- Auditoría de acciones críticas (RNF-10).
-- Los triggers escriben en la misma transacción que la mutación, así que el
-- registro se revierte automáticamente si la operación falla.

ALTER TABLE log_auditoria
    ADD COLUMN IF NOT EXISTS id_empresa VARCHAR(20),
    ADD COLUMN IF NOT EXISTS id_correlacion VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ip_cliente INET,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE log_auditoria l
SET id_empresa = e.id_empresa
FROM empleado e
WHERE e.id_empleado = l.id_empleado
  AND l.id_empresa IS NULL;

ALTER TABLE log_auditoria ALTER COLUMN id_empresa SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_log_empresa_fecha
    ON log_auditoria (id_empresa, fecha_hora DESC);

CREATE OR REPLACE FUNCTION gc_auditar_cambio() RETURNS trigger AS $$
DECLARE
    v_despues jsonb;
    v_antes jsonb;
    v_fila jsonb;
    v_id text;
    v_empresa text;
    v_empleado text;
    v_accion varchar(20);
    v_clave text;
BEGIN
    v_accion := CASE TG_OP
        WHEN 'INSERT' THEN 'crear'
        WHEN 'UPDATE' THEN 'editar'
        ELSE 'eliminar'
    END;

    v_despues := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_fila := COALESCE(v_despues, v_antes);

    v_clave := CASE TG_TABLE_NAME
        WHEN 'empleado' THEN 'id_empleado'
        WHEN 'empresa' THEN 'id_empresa'
        WHEN 'cliente' THEN 'id_cliente'
        WHEN 'proveedor' THEN 'id_proveedor'
        WHEN 'categoria' THEN 'id_categoria'
        WHEN 'medio_pago' THEN 'id_medio_pago'
        WHEN 'producto' THEN 'id_producto'
        WHEN 'pedido_cliente' THEN 'id_pedido_cliente'
        WHEN 'pedido_proveedor' THEN 'id_pedido_proveedor'
        WHEN 'comprobante_venta' THEN 'id_comprobante_venta'
        WHEN 'pago' THEN 'id_pago'
        WHEN 'factura_proveedor' THEN 'id_factura_proveedor'
        ELSE 'id_entidad'
    END;

    v_id := v_fila->>v_clave;
    v_empresa := v_fila->>'id_empresa';
    v_empleado := NULLIF(current_setting('app.id_empleado', true), '');

    IF TG_TABLE_NAME = 'empleado' THEN
        -- Registro público: no hay empleado autenticado todavía.
        IF TG_OP = 'INSERT' AND v_empleado IS NULL THEN
            v_empleado := v_id;
        -- Auto-eliminación: omitir la auditoría para no violar la FK.
        ELSIF TG_OP = 'DELETE' AND v_empleado = v_id THEN
            RETURN NULL;
        END IF;
    END IF;
    IF v_empleado IS NULL OR v_empresa IS NULL OR v_id IS NULL THEN
        RETURN NULL;
    END IF;

    v_antes := v_antes - 'contrasena_hash' - 'contrasena' - 'token_hash'
                     - 'password' - 'jwt' - 'smtp_password';
    v_despues := v_despues - 'contrasena_hash' - 'contrasena' - 'token_hash'
                         - 'password' - 'jwt' - 'smtp_password';

    INSERT INTO log_auditoria (
        accion, data_anterior, data_nueva, entidad_afectada, fecha_hora,
        id_entidad, id_empleado, id_empresa, id_correlacion, ip_cliente, user_agent
    ) VALUES (
        v_accion, v_antes::text, v_despues::text, TG_TABLE_NAME, now(),
        v_id, v_empleado, v_empresa,
        NULLIF(current_setting('app.id_correlacion', true), ''),
        NULLIF(current_setting('app.ip_cliente', true), '')::inet,
        NULLIF(current_setting('app.user_agent', true), '')
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gc_auditoria_inmutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría son inmutables';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_inmutable ON log_auditoria;
CREATE TRIGGER trg_auditoria_inmutable
    BEFORE UPDATE OR DELETE ON log_auditoria
    FOR EACH ROW EXECUTE FUNCTION gc_auditoria_inmutable();

DO $$
DECLARE
    tabla text;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'empleado', 'empresa', 'cliente', 'proveedor', 'categoria',
        'medio_pago', 'producto', 'pedido_cliente', 'pedido_proveedor',
        'comprobante_venta', 'pago', 'factura_proveedor'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_aud_%1$s ON %1$s; '
            'CREATE TRIGGER trg_aud_%1$s '
            'AFTER INSERT OR UPDATE OR DELETE ON %1$s '
            'FOR EACH ROW EXECUTE FUNCTION gc_auditar_cambio()',
            tabla
        );
    END LOOP;
END;
$$;
