from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_catalogo_service
from app.api.v1.routers.auth import get_current_user
from app.schemas.catalogo import AlicuotaIVARead, UnidadRead
from app.schemas.clientes import CondicionIVARead
from app.schemas.pagos import MedioPagoRead
from app.services.catalogo_service import CatalogoService

router = APIRouter(tags=["Catálogo"], dependencies=[Depends(get_current_user)])

ServiceDep = Annotated[CatalogoService, Depends(get_catalogo_service)]


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
