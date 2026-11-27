"""Outbox de correos: cada tenant solo encola mensajes de su empresa."""

from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

EmailJob = dict[str, Any]


class EmailColaRepository:
    def __init__(
        self,
        conn: Connection[dict[str, Any]],
        id_empresa: str | None = None,
    ) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def para_empresa(self, id_empresa: str) -> "EmailColaRepository":
        return EmailColaRepository(self._conn, id_empresa)

    def encolar(
        self,
        *,
        tipo: str,
        destinatario: str,
        asunto: str,
        cuerpo: str,
        cuerpo_html: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        adjunto_nombre: str | None = None,
        adjunto_contenido: bytes | None = None,
        adjunto_tipo_mime: str = "application/pdf",
        reply_to: str | None = None,
        id_referencia: str | None = None,
        origen: str = "manual",
        max_intentos: int = 3,
    ) -> int | None:
        """Encuela un mensaje. Devuelve None si ya existe el automático."""
        if not self._id_empresa:
            raise ValueError("Se requiere id_empresa para encolar un correo")
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO email_cola (
                    id_empresa, tipo, id_referencia, origen, destinatario,
                    cc, bcc, asunto, cuerpo, cuerpo_html, adjunto_nombre,
                    adjunto_contenido, adjunto_tipo_mime, reply_to, max_intentos
                )
                VALUES (
                    %(id_empresa)s, %(tipo)s, %(id_referencia)s, %(origen)s,
                    %(destinatario)s, %(cc)s::text[], %(bcc)s::text[],
                    %(asunto)s, %(cuerpo)s, %(cuerpo_html)s, %(adjunto_nombre)s,
                    %(adjunto_contenido)s, %(adjunto_tipo_mime)s, %(reply_to)s,
                    %(max_intentos)s
                )
                ON CONFLICT (tipo, id_referencia, destinatario)
                WHERE origen = 'automatico' AND id_referencia IS NOT NULL
                DO NOTHING
                RETURNING id_cola_email
                """,
                {
                    "id_empresa": self._id_empresa,
                    "tipo": tipo,
                    "id_referencia": id_referencia,
                    "origen": origen,
                    "destinatario": destinatario,
                    "cc": list(cc or []),
                    "bcc": list(bcc or []),
                    "asunto": asunto,
                    "cuerpo": cuerpo,
                    "cuerpo_html": cuerpo_html,
                    "adjunto_nombre": adjunto_nombre,
                    "adjunto_contenido": adjunto_contenido,
                    "adjunto_tipo_mime": adjunto_tipo_mime,
                    "reply_to": reply_to,
                    "max_intentos": max_intentos,
                },
            )
            fila = cur.fetchone()
            if fila is not None:
                return fila["id_cola_email"]
            if origen != "automatico" or id_referencia is None:
                return None
            cur.execute(
                """
                SELECT id_cola_email
                FROM email_cola
                WHERE id_empresa = %(id_empresa)s
                  AND tipo = %(tipo)s
                  AND id_referencia = %(id_referencia)s
                  AND destinatario = %(destinatario)s
                  AND origen = 'automatico'
                """,
                {
                    "id_empresa": self._id_empresa,
                    "tipo": tipo,
                    "id_referencia": id_referencia,
                    "destinatario": destinatario,
                },
            )
            existente = cur.fetchone()
            return existente["id_cola_email"] if existente else None

    def vincular_envio(self, id_cola_email: int, id_envio: int) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE email_cola
                SET id_envio = %s
                WHERE id_cola_email = %s AND id_empresa = %s
                """,
                (id_envio, id_cola_email, self._id_empresa),
            )

    def reclamar_lote(self, limite: int) -> list[EmailJob]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE email_cola AS q
                SET estado = 'en_proceso', reclamado_en = now()
                FROM (
                    SELECT id_cola_email
                    FROM email_cola
                    WHERE estado = 'pendiente' AND proximo_intento <= now()
                    ORDER BY proximo_intento, id_cola_email
                    LIMIT %s
                    FOR UPDATE SKIP LOCKED
                ) AS candidatos
                WHERE q.id_cola_email = candidatos.id_cola_email
                RETURNING q.*
                """,
                (limite,),
            )
            return cur.fetchall()

    def reclamar(self, id_cola_email: int) -> EmailJob | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE email_cola
                SET estado = 'en_proceso', reclamado_en = now()
                WHERE id_cola_email = %s AND estado = 'pendiente'
                RETURNING *
                """,
                (id_cola_email,),
            )
            return cur.fetchone()

    def reactivar_obsoletos(self, minutos: float) -> int:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE email_cola
                SET estado = 'pendiente',
                    proximo_intento = now(),
                    reclamado_en = NULL
                WHERE estado = 'en_proceso'
                  AND reclamado_en < now() - (%s * interval '1 minute')
                """,
                (minutos,),
            )
            return cur.rowcount or 0

    def marcar_enviado(self, id_cola_email: int) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE email_cola
                SET estado = 'enviado',
                    enviado_en = now(),
                    ultimo_error = NULL,
                    reclamado_en = NULL
                WHERE id_cola_email = %s AND estado = 'en_proceso'
                """,
                (id_cola_email,),
            )
            cur.execute(
                """
                UPDATE comprobante_envio
                SET estado = 'enviado', error = NULL, enviado_en = now()
                WHERE id_envio = (
                    SELECT id_envio FROM email_cola
                    WHERE id_cola_email = %s
                )
                """,
                (id_cola_email,),
            )

    def marcar_fallido(
        self,
        id_cola_email: int,
        error: str,
        *,
        retry_minutes: float,
        terminal: bool = False,
    ) -> str:
        """Devuelve el estado final del job: 'pendiente' o 'fallido'."""
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH actualizado AS (
                    UPDATE email_cola
                    SET intentos = intentos + 1,
                        estado = CASE
                            WHEN %s OR intentos + 1 >= max_intentos
                            THEN 'fallido' ELSE 'pendiente'
                        END,
                        proximo_intento = CASE
                            WHEN %s OR intentos + 1 >= max_intentos
                            THEN proximo_intento
                            ELSE now() + (%s * interval '1 minute')
                        END,
                        ultimo_error = %s,
                        reclamado_en = NULL
                    WHERE id_cola_email = %s AND estado = 'en_proceso'
                    RETURNING estado, tipo, id_referencia
                )
                SELECT estado, tipo, id_referencia FROM actualizado
                """,
                (terminal, terminal, retry_minutes, error[:500], id_cola_email),
            )
            fila = cur.fetchone()
            if fila is None:
                return "fallido"
            estado = fila["estado"]
            if estado != "fallido":
                return estado
            cur.execute(
                """
                UPDATE comprobante_envio
                SET estado = 'fallido', error = %s, enviado_en = now()
                WHERE id_envio = (
                    SELECT id_envio FROM email_cola
                    WHERE id_cola_email = %s
                )
                """,
                (error[:500], id_cola_email),
            )
            if fila["tipo"] == "recuperacion" and fila["id_referencia"]:
                cur.execute(
                    """
                    UPDATE recuperacion_contrasena
                    SET consumido_en = now()
                    WHERE token_hash = %s AND consumido_en IS NULL
                    """,
                    (fila["id_referencia"],),
                )
            return estado

    def transaction(self):
        return self._conn.transaction()
