from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_analitica_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.analitica import (
    AnaliticaRead,
    GranularidadAnalitica,
    PeriodoAnalitica,
)
from app.services.analitica_calculos import AnaliticaDatosInvalidos
from app.services.analitica_pdf import generar_pdf_analitica
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


def obtener_parametros(
    periodo: Annotated[PeriodoAnalitica, Query()] = "mes",
    desde: Annotated[date | None, Query()] = None,
    hasta: Annotated[date | None, Query()] = None,
    granularidad: Annotated[GranularidadAnalitica | None, Query()] = None,
    limite: Annotated[int, Query(ge=1, le=50)] = 10,
    dias_inmovilizado: Annotated[int, Query(ge=0, le=365)] = 0,
    id_categoria: Annotated[str | None, Query(max_length=20)] = None,
    id_cliente: Annotated[str | None, Query(max_length=20)] = None,
    id_proveedor: Annotated[str | None, Query(max_length=20)] = None,
    id_producto: Annotated[str | None, Query(max_length=20)] = None,
    periodos_pronostico: Annotated[int, Query(ge=1, le=6)] = 1,
) -> dict[str, Any]:
    """Parámetros compartidos por la consulta JSON y el reporte PDF."""
    return {
        "periodo": periodo,
        "desde": desde,
        "hasta": hasta,
        "granularidad": granularidad,
        "limite": limite,
        "dias_inmovilizado": dias_inmovilizado,
        "id_categoria": id_categoria,
        "id_cliente": id_cliente,
        "id_proveedor": id_proveedor,
        "id_producto": id_producto,
        "periodos_pronostico": periodos_pronostico,
    }


ParametrosDep = Annotated[dict[str, Any], Depends(obtener_parametros)]


def _obtener_datos(
    service: AnaliticaService,
    rol: str,
    parametros: dict[str, Any],
) -> dict[str, Any]:
    try:
        args = dict(parametros)
        periodo = args.pop("periodo")
        return service.obtener(periodo, rol, **args)
    except AnaliticaDatosInvalidos as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/reporte.pdf", response_class=Response)
def obtener_reporte_pdf(
    service: ServiceDep,
    usuario: PuedeLeer,
    parametros: ParametrosDep,
) -> Response:
    datos = _obtener_datos(service, usuario["rol"], parametros)
    contenido = generar_pdf_analitica(datos)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="reporte-analitico.pdf"'
        },
    )


@router.get("", response_model=AnaliticaRead)
def obtener_analiticas(
    service: ServiceDep,
    usuario: PuedeLeer,
    parametros: ParametrosDep,
) -> AnaliticaRead:
    datos = _obtener_datos(service, usuario["rol"], parametros)
    return AnaliticaRead.model_validate(datos)
