BEGIN;

CREATE SEQUENCE IF NOT EXISTS categoria_id_seq;

CREATE TABLE IF NOT EXISTS categoria (
    id_categoria VARCHAR(20) PRIMARY KEY,
    nombre       VARCHAR(120) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_categoria_nombre_lower
    ON categoria (LOWER(nombre));

INSERT INTO categoria (id_categoria, nombre)
VALUES
    ('CAT-0001', 'Informática'),
    ('CAT-0002', 'Periféricos'),
    ('CAT-0003', 'Almacenamiento'),
    ('CAT-0004', 'Sin categoría')
ON CONFLICT DO NOTHING;

SELECT setval(
    'categoria_id_seq',
    COALESCE(
        MAX(NULLIF(regexp_replace(id_categoria, '\D', '', 'g'), '')::int),
        0
    ) + 1,
    false
)
FROM categoria;

COMMIT;
