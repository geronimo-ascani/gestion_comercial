from typing import Any

from psycopg import errors

from app.repositories.proveedor_repository import ProveedorRepository, ProveedorRow
from app.schemas.proveedores import ProveedorCreate, ProveedorUpdate


class ProveedorError(Exception):
    pass


class ProveedorNoEncontrado(ProveedorError):
    pass


class ProveedorDuplicado(ProveedorError):
    pass


class ProveedorEnUso(ProveedorError):
    pass


class ProveedorSinCambios(ProveedorError):
    pass


class ProveedorService:
    def __init__(self, repo: ProveedorRepository) -> None:
        self._repo = repo

    @staticmethod
    def _publico(row: ProveedorRow) -> dict[str, Any]:
        return {
            "id_proveedor": row["id_proveedor"],
            "banco": row["banco"],
            "cuenta": row["cuenta"],
            "cuit": row["cuit"],
            "email": row["email"],
            "razon_social": row["razon_social"],
            "saldo": row["saldo"],
            "telefono": row["telefono"],
            "direccion": {
                "altura": row["direccion_altura"] or "",
                "calle": row["direccion_calle"] or "",
                "cp": row["direccion_cp"] or "",
                "depto": row["direccion_depto"] or "",
                "localidad": row["direccion_localidad"] or "",
                "provincia": row["direccion_provincia"] or "",
            },
        }

    def listar(
        self, q: str | None, limit: int, offset: int
    ) -> list[dict[str, Any]]:
        busqueda = q.strip() if q else None
        return [
            self._publico(row)
            for row in self._repo.listar(busqueda or None, limit, offset)
        ]

    def obtener(self, id_proveedor: str) -> dict[str, Any]:
        row = self._repo.obtener(id_proveedor)
        if row is None:
            raise ProveedorNoEncontrado(id_proveedor)
        return self._publico(row)

    def crear(self, datos: ProveedorCreate) -> dict[str, Any]:
        values = datos.model_dump(exclude={"direccion"})
        try:
            with self._repo.transaction():
                if self._repo.cuit_existe(values["cuit"]):
                    raise ProveedorDuplicado(
                        "Ya existe un proveedor con ese CUIT"
                    )
                id_proveedor = self._repo.crear(values)
                self._repo.guardar_direccion(
                    id_proveedor, datos.direccion.model_dump()
                )
                row = self._repo.obtener(id_proveedor)
                assert row is not None
                return self._publico(row)
        except errors.UniqueViolation as exc:
            raise ProveedorDuplicado(
                "Ya existe un proveedor con ese CUIT"
            ) from exc

    def actualizar(
        self, id_proveedor: str, datos: ProveedorUpdate
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
            raise ProveedorSinCambios(id_proveedor)
        self.obtener(id_proveedor)
        try:
            with self._repo.transaction():
                if "cuit" in cambios and self._repo.cuit_existe(
                    cambios["cuit"], excluir_id=id_proveedor
                ):
                    raise ProveedorDuplicado(
                        "Ya existe un proveedor con ese CUIT"
                    )
                if not self._repo.actualizar(id_proveedor, cambios):
                    raise ProveedorNoEncontrado(id_proveedor)
                if direccion is not None:
                    self._repo.guardar_direccion(
                        id_proveedor, direccion.model_dump()
                    )
                row = self._repo.obtener(id_proveedor)
                assert row is not None
                return self._publico(row)
        except errors.UniqueViolation as exc:
            raise ProveedorDuplicado(
                "Ya existe un proveedor con ese CUIT"
            ) from exc

    def eliminar(self, id_proveedor: str) -> None:
        self.obtener(id_proveedor)
        try:
            if not self._repo.eliminar(id_proveedor):
                raise ProveedorNoEncontrado(id_proveedor)
        except errors.ForeignKeyViolation as exc:
            raise ProveedorEnUso(id_proveedor) from exc
