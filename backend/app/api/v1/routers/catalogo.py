from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_catalogo_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.catalogo import AlicuotaIVARead, UnidadRead
from app.schemas.clientes import CondicionIVARead
from app.schemas.pagos import MedioPagoCreate, MedioPagoRead
from app.services.catalogo_service import (
    CatalogoError,
    CatalogoService,
    MedioPagoDuplicado,
)

router = APIRouter(tags=["Catálogo"], dependencies=[Depends(get_current_user)])

ServiceDep = Annotated[CatalogoService, Depends(get_catalogo_service)]
PuedeGestionar = Annotated[
    dict,
    Depends(require_roles("administrador")),
]


@router.get("/alicuotas-iva", response_model=list[AlicuotaIVARead])
def listar_alicuotas(service: ServiceDep) -> list[AlicuotaIVARead]:
    return [
        AlicuotaIVARead.model_validate(alicuota)
        for alicuota in service.listar_alicuotas()
    ]


@router.get("/unidades", response_model=list[UnidadRead])
def listar_unidades(service: ServiceDep) -> list[UnidadRead]:
    return [
        UnidadRead.model_validate(unidad)
        for unidad in service.listar_unidades()
    ]


@router.get("/condiciones-iva", response_model=list[CondicionIVARead])
def listar_condiciones_iva(
    service: ServiceDep,
) -> list[CondicionIVARead]:
    return [
        CondicionIVARead.model_validate(condicion)
        for condicion in service.listar_condiciones_iva()
    ]


@router.get("/medios-pago", response_model=list[MedioPagoRead])
def listar_medios_pago(service: ServiceDep) -> list[MedioPagoRead]:
    return [
        MedioPagoRead.model_validate(medio)
        for medio in service.listar_medios_pago()
    ]


@router.post(
    "/medios-pago",
    response_model=MedioPagoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_medio_pago(
    datos: MedioPagoCreate,
    service: ServiceDep,
    _: PuedeGestionar,
) -> MedioPagoRead:
    try:
        return MedioPagoRead.model_validate(
            service.crear_medio_pago(datos)
        )
    except MedioPagoDuplicado as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except CatalogoError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
