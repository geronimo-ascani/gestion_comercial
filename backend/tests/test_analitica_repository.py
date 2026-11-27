from datetime import date

from app.repositories.analitica_repository import (
    _SELECT_DEMANDA,
    AnaliticaRepository,
)


class FakeCursor:
    def __init__(self) -> None:
        self.consulta = ""
        self.parametros: dict = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        return None

    def execute(self, consulta, parametros) -> None:
        self.consulta = str(consulta)
        self.parametros = parametros

    def fetchall(self):
        return []


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def cursor(self, **_kwargs):
        return self._cursor


def test_historial_de_demanda_agrupa_la_categoria_seleccionada() -> None:
    """La columna `p.id_categoria` se selecciona, así que debe agruparse."""
    consulta = str(_SELECT_DEMANDA)
    assert "p.id_categoria," in consulta
    assert "GROUP BY d.id_producto, p.nombre, p.id_categoria, mes" in consulta

    cursor = FakeCursor()
    repo = AnaliticaRepository(FakeConnection(cursor), "EMP-0001")
    assert (
        repo.listar_historial_demanda(date(2026, 6, 1), date(2026, 11, 17))
        == []
    )
    assert cursor.parametros["id_empresa"] == "EMP-0001"
