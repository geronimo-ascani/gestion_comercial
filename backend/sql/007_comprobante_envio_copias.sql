-- Registra las copias (CC/BCC) utilizadas en cada envío de comprobante.
-- Migration aditiva: no modifica migraciones ya aplicadas.
ALTER TABLE comprobante_envio
    ADD COLUMN IF NOT EXISTS cc TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS bcc TEXT[] NOT NULL DEFAULT '{}';
