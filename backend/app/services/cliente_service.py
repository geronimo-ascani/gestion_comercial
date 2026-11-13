from typing import Any

from psycopg import errors

from app.repositories.cliente_repository import ClienteRepository, ClienteRow
from app.schemas.clientes import ClienteCreate, ClienteUpdate


class ClienteError(Exception):
    pass


class ClienteNoEncontrado(ClienteError):
    pass


class ClienteDuplicado(ClienteError):
    pass


class ClienteEnUso(ClienteError):
    pass


class ClienteDatosInvalidos(ClienteError):
    pass


class ClienteSinCambios(ClienteError):
    pass


class ClienteService:
    def __init__(self, repo: ClienteRepository) -> None:
        self._repo = repo

    @staticmethod
    def _publico(row: ClienteRow) -> dict[str, Any]:
        return {
            "id_cliente": row["id_cliente"],
            "apellido": row["apellido"],
            "dni_cuit": row["dni_cuit"],
            "email": row["email"],
            "nombre": row["nombre"],
            "saldo": row["saldo"],
            "telefono": row["telefono"],
            "id_condicion_iva": row["id_condicion_iva"],
            "condicion_iva_descripcion": row["condicion_iva_descripcion"],
            "direccion": {
                "altura": row["direccion_altura"] or "",
                "calle": row["direccion_calle"] or "",
                "cp": row["direccion_cp"] or "",
                "depto": row["direccion_depto"] or "",
                "localidad": row["direccion_localidad"] or "",
                "provincia": row["direccion_provincia"] or "",
            },
        }

    def listar(self, q: str | None, limit: int, offset: int) -> list[dict[str, Any]]:
        busqueda = q.strip() if q else None
        return [self._publico(row) for row in self._repo.listar(busqueda or None, limit, offset)]

    def obtener(self, id_cliente: str) -> dict[str, Any]:
        row = self._repo.obtener(id_cliente)
        if row is None:
            raise ClienteNoEncontrado(id_cliente)
        return self._publico(row)

    def crear(self, datos: ClienteCreate) -> dict[str, Any]:
        values = datos.model_dump(exclude={"direccion"})
        if not self._repo.condicion_iva_existe(values["id_condicion_iva"]):
            raise ClienteDatosInvalidos("La condición de IVA seleccionada no existe")
        try:
            with self._repo.transaction():
                if self._repo.dni_cuit_existe(values["dni_cuit"]):
                    raise ClienteDuplicado(
                        "Ya existe un cliente con ese DNI/CUIT"
                    )
                id_cliente = self._repo.crear(values)
                self._repo.guardar_direccion(
                    id_cliente, datos.direccion.model_dump()
                )
                row = self._repo.obtener(id_cliente)
                assert row is not None
                return self._publico(row)
        except errors.UniqueViolation as exc:
            raise ClienteDuplicado(
                "Ya existe un cliente con ese DNI/CUIT"
            ) from exc
        except errors.ForeignKeyViolation as exc:
            raise ClienteDatosInvalidos(
                "La condición de IVA seleccionada no existe"
            ) from exc

    def actualizar(
        self, id_cliente: str, datos: ClienteUpdate
    ) -> dict[str, Any]:
        cambios = {
            key: value
            for key, value in datos.model_dump(
                exclude_unset=True, exclude={"direccion"}
            ).items()
            if value is not None
        }
        direccion = datos.direccion
        if not cambios and direccion is None:
            raise ClienteSinCambios(id_cliente)
        self.obtener(id_cliente)
        if (
            "id_condicion_iva" in cambios
            and not self._repo.condicion_iva_existe(cambios["id_condicion_iva"])
        ):
            raise ClienteDatosInvalidos("La condición de IVA seleccionada no existe")
        try:
            with self._repo.transaction():
                if "dni_cuit" in cambios and self._repo.dni_cuit_existe(
                    cambios["dni_cuit"], excluir_id=id_cliente
                ):
                    raise ClienteDuplicado(
                        "Ya existe un cliente con ese DNI/CUIT"
                    )
                if not self._repo.actualizar(id_cliente, cambios):
                    raise ClienteNoEncontrado(id_cliente)
                if direccion is not None:
                    self._repo.guardar_direccion(
                        id_cliente, direccion.model_dump()
                    )
                row = self._repo.obtener(id_cliente)
                assert row is not None
                return self._publico(row)
        except errors.UniqueViolation as exc:
            raise ClienteDuplicado(
                "Ya existe un cliente con ese DNI/CUIT"
            ) from exc
        except errors.ForeignKeyViolation as exc:
            raise ClienteDatosInvalidos(
                "La condición de IVA seleccionada no existe"
            ) from exc

    def eliminar(self, id_cliente: str) -> None:
        self.obtener(id_cliente)
        try:
            if not self._repo.eliminar(id_cliente):
                raise ClienteNoEncontrado(id_cliente)
        except errors.ForeignKeyViolation as exc:
            raise ClienteEnUso(id_cliente) from exc
