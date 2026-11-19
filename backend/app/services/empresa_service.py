import re
from typing import Any

from psycopg import errors

from app.repositories.empresa_repository import EmpresaRepository, EmpresaRow
from app.schemas.empresas import EmpresaUpdate


class EmpresaError(Exception):
    pass


class EmpresaNoEncontrada(EmpresaError):
    pass


class EmpresaNoConfigurada(EmpresaError):
    pass


class EmpresaDatosInvalidos(EmpresaError):
    pass


class EmpresaDuplicada(EmpresaError):
    pass


def _cuit_completo(cuit: str | None) -> bool:
    return bool(cuit) and len(re.sub(r"[^0-9]", "", cuit or "")) == 11


class EmpresaService:
    def __init__(self, repo: EmpresaRepository) -> None:
        self._repo = repo

    def obtener(self, id_empresa: str) -> EmpresaRow:
        empresa = self._repo.obtener(id_empresa)
        if empresa is None:
            raise EmpresaNoEncontrada(id_empresa)
        return empresa

    def obtener_actual(self, id_empresa: str) -> EmpresaRow:
        return self.obtener(id_empresa)

    def crear_placeholder(self, razon_social: str) -> str:
        return self._repo.crear_placeholder(razon_social)

    def actualizar(
        self, id_empresa: str, datos: EmpresaUpdate
    ) -> EmpresaRow:
        cambios: dict[str, Any] = datos.model_dump(
            exclude_unset=True, exclude_none=True
        )
        try:
            with self._repo.transaction():
                if self._repo.obtener(id_empresa) is None:
                    raise EmpresaNoEncontrada(id_empresa)
                cuit = cambios.get("cuit")
                if cuit and self._repo.cuit_existe(cuit, excluir_id=id_empresa):
                    raise EmpresaDuplicada(
                        f"Ya existe una empresa con el CUIT '{cuit}'"
                    )
                self._repo.actualizar(id_empresa, cambios)
                empresa = self._repo.obtener(id_empresa)
                if empresa is None:
                    raise EmpresaNoEncontrada(id_empresa)
                return empresa
        except errors.UniqueViolation as exc:
            raise EmpresaDuplicada(
                "Ya existe una empresa con ese CUIT"
            ) from exc

    def obtener_emisora(self, id_empresa: str) -> EmpresaRow:
        empresa = self._repo.obtener(id_empresa)
        if empresa is None:
            raise EmpresaNoConfigurada(
                "La empresa emisora no está configurada"
            )
        if not empresa["activa"]:
            raise EmpresaDatosInvalidos("La empresa emisora está inactiva")
        if not _cuit_completo(empresa["cuit"]):
            raise EmpresaDatosInvalidos(
                "Completá el CUIT de la empresa antes de emitir comprobantes"
            )
        return empresa
