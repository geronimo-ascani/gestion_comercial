import pytest
from pydantic import ValidationError

from app.schemas.clientes import ClienteCreate, ClienteRead, ClienteUpdate
from app.schemas.proveedores import (
    ProveedorCreate,
    ProveedorRead,
    ProveedorUpdate,
)

_ADDRESS = {
    "altura": "123",
    "calle": "Avenida Central",
    "cp": "1000",
    "depto": "",
    "localidad": "CABA",
    "provincia": "Buenos Aires",
}


def test_cliente_normaliza_email_y_acepta_dni() -> None:
    cliente = ClienteCreate.model_validate(
        {
            "apellido": "Pérez",
            "dni_cuit": "33.251.234",
            "direccion": _ADDRESS,
            "email": " CLIENTE@example.com ",
            "id_condicion_iva": "CIV-0001",
            "nombre": "Ana",
            "telefono": "1144445555",
        }
    )

    assert cliente.email == "cliente@example.com"
    assert cliente.dni_cuit == "33251234"


def test_cliente_no_permite_editar_saldo() -> None:
    with pytest.raises(ValidationError):
        ClienteUpdate.model_validate({"saldo": 500})


def test_cliente_rechaza_dni_de_longitud_invalida() -> None:
    with pytest.raises(ValidationError):
        ClienteCreate.model_validate(
            {
                "apellido": "Pérez",
                "dni_cuit": "123",
                "direccion": _ADDRESS,
                "email": "cliente@example.com",
                "id_condicion_iva": "CIV-0001",
                "nombre": "Ana",
                "telefono": "1144445555",
            }
        )


def test_cliente_update_normaliza_dni_cuit() -> None:
    cliente = ClienteUpdate.model_validate({"dni_cuit": "33.251.234"})

    assert cliente.dni_cuit == "33251234"


def test_cliente_read_acepta_direccion_legacy_vacia() -> None:
    cliente = ClienteRead.model_validate(
        {
            "apellido": "Pérez",
            "dni_cuit": "33251234",
            "direccion": {
                "altura": "",
                "calle": "",
                "cp": "",
                "depto": "",
                "localidad": "",
                "provincia": "",
            },
            "email": "ana@example.com",
            "id_cliente": "CLI-0001",
            "id_condicion_iva": "CIV-0001",
            "condicion_iva_descripcion": "Consumidor final",
            "nombre": "Ana",
            "saldo": 0,
            "telefono": "1144445555",
        }
    )

    assert cliente.direccion.cp == ""


def test_proveedor_exige_cuit_de_once_digitos() -> None:
    with pytest.raises(ValidationError):
        ProveedorCreate.model_validate(
            {
                "banco": "Banco Demo",
                "cuenta": "12345",
                "cuit": "12345",
                "direccion": _ADDRESS,
                "email": "proveedor@example.com",
                "razon_social": "Proveedor Demo",
                "telefono": "1144445555",
            }
        )


def test_proveedor_normaliza_cuit_en_alta_y_edicion() -> None:
    proveedor = ProveedorCreate.model_validate(
        {
            "banco": "Banco Demo",
            "cuenta": "12345",
            "cuit": "20-12345678-9",
            "direccion": _ADDRESS,
            "email": "proveedor@example.com",
            "razon_social": "Proveedor Demo",
            "telefono": "1144445555",
        }
    )
    actualizacion = ProveedorUpdate.model_validate(
        {"cuit": "20-12345678-9"}
    )

    assert proveedor.cuit == "20123456789"
    assert actualizacion.cuit == "20123456789"


def test_proveedor_read_acepta_direccion_legacy_vacia() -> None:
    proveedor = ProveedorRead.model_validate(
        {
            "banco": "Banco Demo",
            "cuenta": "12345",
            "cuit": "20123456789",
            "direccion": {
                "altura": "",
                "calle": "",
                "cp": "",
                "depto": "",
                "localidad": "",
                "provincia": "",
            },
            "email": "proveedor@example.com",
            "id_proveedor": "PRV-0001",
            "razon_social": "Proveedor Demo",
            "saldo": 0,
            "telefono": "1144445555",
        }
    )

    assert proveedor.direccion.cp == ""


def test_proveedor_no_permite_editar_saldo() -> None:
    with pytest.raises(ValidationError):
        ProveedorUpdate.model_validate({"saldo": 500})
