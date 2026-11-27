from contextlib import nullcontext
from decimal import Decimal

import pytest

from app.schemas.proveedores import ProveedorCreate, ProveedorUpdate
from app.services.proveedor_service import (
    ProveedorDatosInvalidos,
    ProveedorService,
)


_CREAR = ProveedorCreate.model_validate(
    {
        "razon_social": "Proveedor SA",
        "id_condicion_iva": "CIV-INVALIDA",
        "cuit": "20123456789",
        "email": "proveedor@example.com",
        "telefono": "1144445555",
        "banco": "Banco",
        "cuenta": "1",
        "direccion": {
            "calle": "Av. Siempre Viva",
            "altura": "123",
            "depto": "",
            "cp": "1000",
            "localidad": "CABA",
            "provincia": "CABA",
        },
    }
)


class FakeRepo:
    def transaction(self):
        return nullcontext()

    def condicion_iva_existe(self, id_condicion_iva):
        return id_condicion_iva == "CIV-0005"

    def condicion_iva_codigo(self, id_condicion_iva):
        return "5" if id_condicion_iva == "CIV-0005" else "1"

    def cuit_existe(self, _cuit, excluir_id=None):
        return False

    def crear(self, _datos):
        raise AssertionError("No se debe insertar con una condición inválida")

    def actualizar(self, _id, _campos):
        raise AssertionError("No se debe actualizar con una condición inválida")

    def obtener(self, _id):
        return {
            "id_proveedor": "PRV-0001",
            "id_condicion_iva": None,
            "banco": "Banco",
            "cuenta": "1",
            "cuit": "20123456789",
            "email": "proveedor@example.com",
            "razon_social": "Proveedor SA",
            "saldo": Decimal("0"),
            "telefono": "1144445555",
            "direccion_altura": "123",
            "direccion_calle": "Av. Siempre Viva",
            "direccion_cp": "1000",
            "direccion_depto": "",
            "direccion_localidad": "CABA",
            "direccion_provincia": "CABA",
        }


def test_crear_rechaza_condicion_iva_inexistente() -> None:
    with pytest.raises(ProveedorDatosInvalidos):
        ProveedorService(FakeRepo()).crear(_CREAR)


def test_actualizar_rechaza_condicion_iva_inexistente() -> None:
    datos = ProveedorUpdate.model_validate({"id_condicion_iva": "CIV-INVALIDA"})
    with pytest.raises(ProveedorDatosInvalidos):
        ProveedorService(FakeRepo()).actualizar("PRV-0001", datos)


def test_crear_rechaza_consumidor_final() -> None:
    datos = ProveedorCreate.model_validate(
        {**_CREAR.model_dump(), "id_condicion_iva": "CIV-0005"}
    )
    with pytest.raises(ProveedorDatosInvalidos):
        ProveedorService(FakeRepo()).crear(datos)


def test_actualizar_rechaza_consumidor_final() -> None:
    datos = ProveedorUpdate.model_validate({"id_condicion_iva": "CIV-0005"})
    with pytest.raises(ProveedorDatosInvalidos):
        ProveedorService(FakeRepo()).actualizar("PRV-0001", datos)


def test_actualizar_proveedor_legacy_no_exige_condicion() -> None:
    class RepoEditable(FakeRepo):
        def actualizar(self, _id, cambios):
            return True

        def transaction(self):
            return nullcontext()

    actualizado = ProveedorService(RepoEditable()).actualizar(
        "PRV-0001", ProveedorUpdate.model_validate({"telefono": "123"})
    )
    assert actualizado["id_proveedor"] == "PRV-0001"
