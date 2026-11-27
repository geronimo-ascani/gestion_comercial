-- RF-30: el hash SHA-256 del token de recuperación tiene 64 caracteres.
-- La columna creada en 012 era demasiado corta para ese identificador.

ALTER TABLE email_cola
    ALTER COLUMN id_referencia TYPE VARCHAR(128);
