from psycopg import errors

from app.repositories.catalogo_repository import (
    AlicuotaRow,
    CondicionIVARow,
    CatalogoRepository,
    MedioPagoRow,
    UnidadRow,
)
from app.schemas.pagos import MedioPagoCreate


class CatalogoError(Exception):
    pass


class MedioPagoDuplicado(CatalogoError):
    pass


class CatalogoService:
    def __init__(self, repo: CatalogoRepository) -> None:
        self._repo = repo

    def listar_alicuotas(self) -> list[AlicuotaRow]:
        return self._repo.listar_alicuotas()

    def listar_unidades(self) -> list[UnidadRow]:
        return self._repo.listar_unidades()

    def listar_condiciones_iva(self) -> list[CondicionIVARow]:
        return self._repo.listar_condiciones_iva()

    def listar_medios_pago(self) -> list[MedioPagoRow]:
        return self._repo.listar_medios_pago()

    def crear_medio_pago(self, datos: MedioPagoCreate) -> MedioPagoRow:
        try:
            with self._repo.transaction():
                return self._repo.crear_medio_pago(
                    datos.medio_pago, datos.tipo_cobro
                )
        except errors.UniqueViolation as exc:
            raise MedioPagoDuplicado(
                "Ya existe un medio de pago con ese nombre"
            ) from exc
