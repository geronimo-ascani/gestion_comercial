from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import get_cuenta_corriente_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.cuentas_corrientes import (
    CuentasCorrientesClientesRead,
    CuentasCorrientesProveedoresRead,
    DetalleCuentasClientesRead,
    DetalleCuentasProveedoresRead,
)
from app.services.cuenta_corriente_service import (
    CuentaCorrienteNoEncontrado,
    CuentaCorrienteService,
)
from app.services.cuentas_corrientes_calculos import (
    CuentasCorrientesDatosInvalidos,
    resolver_rango,
)

router = APIRouter(
    prefix="/cuentas-corrientes",
    tags=["Cuentas corrientes"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[
    CuentaCorrienteService, Depends(get_cuenta_corriente_service)
]
PuedeVerClientes = Annotated[
    dict[str, Any], Depends(require_roles("administrador", "ventas"))
]
PuedeVerProveedores = Annotated[
    dict[str, Any], Depends(require_roles("administrador", "abastecimiento"))
]
ClienteId = Annotated[str, Path(min_length=1, max_length=20)]
ProveedorId = Annotated[str, Path(min_length=1, max_length=20)]


def _parametros(
    desde: date | None,
    hasta: date | None,
    id_cliente: str | None,
    id_proveedor: str | None,
) -> dict[str, Any]:
    try:
        desde, hasta = resolver_rango(desde, hasta)
    except CuentasCorrientesDatosInvalidos as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    return {
        "desde": desde,
        "hasta": hasta,
        "id_cliente": id_cliente,
        "id_proveedor": id_proveedor,
    }


def obtener_parametros_clientes(
    desde: Annotated[date | None, Query()] = None,
    hasta: Annotated[date | None, Query()] = None,
    id_cliente: Annotated[str | None, Query(max_length=20)] = None,
) -> dict[str, Any]:
    parametros = _parametros(desde, hasta, id_cliente, None)
    return {
        "desde": parametros["desde"],
        "hasta": parametros["hasta"],
        "id_cliente": parametros["id_cliente"],
    }


def obtener_parametros_proveedores(
    desde: Annotated[date | None, Query()] = None,
    hasta: Annotated[date | None, Query()] = None,
    id_proveedor: Annotated[str | None, Query(max_length=20)] = None,
) -> dict[str, Any]:
    parametros = _parametros(desde, hasta, None, id_proveedor)
    return {
        "desde": parametros["desde"],
        "hasta": parametros["hasta"],
        "id_proveedor": parametros["id_proveedor"],
    }


def obtener_rango(
    desde: Annotated[date | None, Query()] = None,
    hasta: Annotated[date | None, Query()] = None,
) -> dict[str, Any]:
    parametros = _parametros(desde, hasta, None, None)
    return {"desde": parametros["desde"], "hasta": parametros["hasta"]}


ParametrosClientes = Annotated[
    dict[str, Any], Depends(obtener_parametros_clientes)
]
ParametrosProveedores = Annotated[
    dict[str, Any], Depends(obtener_parametros_proveedores)
]
Rango = Annotated[dict[str, Any], Depends(obtener_rango)]


def _ejecutar(operacion, *args, **kwargs) -> Any:
    try:
        return operacion(*args, **kwargs)
    except CuentaCorrienteNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe la entidad '{exc.args[0]}'",
        ) from exc
    except CuentasCorrientesDatosInvalidos as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get(
    "/clientes",
    response_model=CuentasCorrientesClientesRead,
)
def listar_cuentas_clientes(
    service: ServiceDep,
    _: PuedeVerClientes,
    parametros: ParametrosClientes,
) -> CuentasCorrientesClientesRead:
    datos = _ejecutar(service.listar_clientes, **parametros)
    return CuentasCorrientesClientesRead.model_validate(datos)


@router.get(
    "/clientes/{id_cliente}",
    response_model=DetalleCuentasClientesRead,
)
def obtener_cuenta_cliente(
    service: ServiceDep,
    id_cliente: ClienteId,
    _: PuedeVerClientes,
    parametros: Rango,
) -> DetalleCuentasClientesRead:
    datos = _ejecutar(
        service.obtener_cliente,
        id_cliente,
        parametros["desde"],
        parametros["hasta"],
    )
    return DetalleCuentasClientesRead.model_validate(datos)


@router.get(
    "/proveedores",
    response_model=CuentasCorrientesProveedoresRead,
)
def listar_cuentas_proveedores(
    service: ServiceDep,
    _: PuedeVerProveedores,
    parametros: ParametrosProveedores,
) -> CuentasCorrientesProveedoresRead:
    datos = _ejecutar(service.listar_proveedores, **parametros)
    return CuentasCorrientesProveedoresRead.model_validate(datos)


@router.get(
    "/proveedores/{id_proveedor}",
    response_model=DetalleCuentasProveedoresRead,
)
def obtener_cuenta_proveedor(
    service: ServiceDep,
    id_proveedor: ProveedorId,
    _: PuedeVerProveedores,
    parametros: Rango,
) -> DetalleCuentasProveedoresRead:
    datos = _ejecutar(
        service.obtener_proveedor,
        id_proveedor,
        parametros["desde"],
        parametros["hasta"],
    )
    return DetalleCuentasProveedoresRead.model_validate(datos)
