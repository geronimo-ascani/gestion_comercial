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

    def condicion_iva_existe(self, _id_condicion_iva):
        return False

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
