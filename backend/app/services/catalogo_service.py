from app.repositories.catalogo_repository import (
    AlicuotaRow,
    CondicionIVARow,
    CatalogoRepository,
    UnidadRow,
)


class CatalogoService:
    def __init__(self, repo: CatalogoRepository) -> None:
        self._repo = repo

    def listar_alicuotas(self) -> list[AlicuotaRow]:
        return self._repo.listar_alicuotas()

    def listar_unidades(self) -> list[UnidadRow]:
        return self._repo.listar_unidades()

    def listar_condiciones_iva(self) -> list[CondicionIVARow]:
        return self._repo.listar_condiciones_iva()
