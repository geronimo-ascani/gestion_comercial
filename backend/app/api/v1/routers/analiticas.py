from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_analitica_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.analitica import AnaliticaRead, PeriodoAnalitica
from app.services.analitica_calculos import AnaliticaDatosInvalidos
from app.services.analitica_service import AnaliticaService

router = APIRouter(
    prefix="/analiticas",
    tags=["Analíticas"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[AnaliticaService, Depends(get_analitica_service)]
PuedeLeer = Annotated[
    dict[str, Any],
    Depends(
        require_roles("administrador", "ventas", "abastecimiento")
    ),
]


@router.get("", response_model=AnaliticaRead)
def obtener_analiticas(
    service: ServiceDep,
    usuario: PuedeLeer,
    periodo: Annotated[PeriodoAnalitica, Query()] = "mes",
) -> AnaliticaRead:
    try:
        datos = service.obtener(periodo, usuario["rol"])
    except AnaliticaDatosInvalidos as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    return AnaliticaRead.model_validate(datos)
