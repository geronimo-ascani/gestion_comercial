from psycopg import errors

from app.repositories.categoria_repository import CategoriaRepository, CategoriaRow


class CategoriaError(Exception):
    pass


class CategoriaNoEncontrada(CategoriaError):
    pass


class CategoriaDuplicada(CategoriaError):
    pass


class CategoriaEnUso(CategoriaError):
    pass


class CategoriaSinCambios(CategoriaError):
    pass


class CategoriaService:
    def __init__(self, repo: CategoriaRepository) -> None:
        self._repo = repo

    def listar(self, q: str | None, limit: int, offset: int) -> list[CategoriaRow]:
        busqueda = q.strip() if q else None
        return self._repo.listar(busqueda or None, limit, offset)

    def obtener(self, id_categoria: str) -> CategoriaRow:
        categoria = self._repo.obtener(id_categoria)
        if categoria is None:
            raise CategoriaNoEncontrada(id_categoria)
        return categoria

    def crear(self, nombre: str) -> CategoriaRow:
        nombre = nombre.strip()
        if self._repo.existe_nombre(nombre):
            raise CategoriaDuplicada(nombre)

        try:
            return self._repo.crear(nombre)
        except errors.UniqueViolation as exc:
            raise CategoriaDuplicada(nombre) from exc

    def actualizar(self, id_categoria: str, nombre: str | None) -> CategoriaRow:
        if nombre is None:
            raise CategoriaSinCambios(id_categoria)

        actual = self.obtener(id_categoria)
        nombre = nombre.strip()
        if actual["nombre"] == nombre:
            return actual

        if self._repo.existe_nombre(nombre, excluir_id=id_categoria):
            raise CategoriaDuplicada(nombre)

        try:
            categoria = self._repo.actualizar(id_categoria, nombre)
        except errors.UniqueViolation as exc:
            raise CategoriaDuplicada(nombre) from exc

        if categoria is None:
            raise CategoriaNoEncontrada(id_categoria)
        return categoria

    def eliminar(self, id_categoria: str) -> None:
        self.obtener(id_categoria)

        if self._repo.esta_en_uso(id_categoria):
            raise CategoriaEnUso(id_categoria)

        try:
            eliminada = self._repo.eliminar(id_categoria)
        except errors.ForeignKeyViolation as exc:
            raise CategoriaEnUso(id_categoria) from exc

        if not eliminada:
            raise CategoriaNoEncontrada(id_categoria)
