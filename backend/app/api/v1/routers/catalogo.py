from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_catalogo_service
from app.schemas.catalogo import AlicuotaIVARead, UnidadRead
from app.services.catalogo_service import CatalogoService

router = APIRouter(tags=["Catálogo"])

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
