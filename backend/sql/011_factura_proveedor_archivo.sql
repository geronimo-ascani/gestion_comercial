BEGIN;

-- La factura del proveedor es el comprobante externo recibido del proveedor.
-- Se conserva como PDF/JPG dentro de la base para que cabecera y archivo
-- compartan la misma transacción y el mismo alcance por empresa.

CREATE TABLE IF NOT EXISTS factura_proveedor_archivo (
    id_factura_proveedor VARCHAR(20) PRIMARY KEY
        REFERENCES factura_proveedor(id_factura_proveedor) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL
        CHECK (mime_type IN ('application/pdf', 'image/jpeg')),
    tamanio INTEGER NOT NULL
        CHECK (tamanio > 0 AND tamanio <= 3145728),
    contenido BYTEA NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_factura_proveedor_archivo_tamanio
        CHECK (octet_length(contenido) = tamanio)
);

COMMIT;
