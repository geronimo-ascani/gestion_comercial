from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_reporte_cobros_pagos_service
from app.api.v1.routers.auth import get_current_user, require_roles
from app.schemas.reportes_cobros_pagos import ReporteCobrosPagosRead
from app.services.reporte_cobros_pagos_calculos import (
    ReporteCobrosPagosDatosInvalidos,
    validar_filtros,
)
from app.services.reporte_cobros_pagos_pdf import (
    generar_pdf_reporte_cobros_pagos,
)
from app.services.reporte_cobros_pagos_service import (
    ReporteCobrosPagosService,
)

router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[
    ReporteCobrosPagosService, Depends(get_reporte_cobros_pagos_service)
]
SoloAdmin = Annotated[
    dict[str, Any], Depends(require_roles("administrador"))
]


def obtener_parametros(
    desde: Annotated[date, Query()],
    hasta: Annotated[date, Query()],
    id_cliente: Annotated[str | None, Query(max_length=20)] = None,
    id_proveedor: Annotated[str | None, Query(max_length=20)] = None,
) -> dict[str, Any]:
    try:
        validar_filtros(desde, hasta, id_cliente, id_proveedor)
    except ReporteCobrosPagosDatosInvalidos as exc:
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


ParametrosDep = Annotated[dict[str, Any], Depends(obtener_parametros)]


def _obtener_datos(
    service: ReporteCobrosPagosService, parametros: dict[str, Any]
) -> dict[str, Any]:
    try:
        return service.obtener(**parametros)
    except ReporteCobrosPagosDatosInvalidos as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get("/cobros-pagos", response_model=ReporteCobrosPagosRead)
def obtener_reporte_cobros_pagos(
    service: ServiceDep,
    _: SoloAdmin,
    parametros: ParametrosDep,
) -> ReporteCobrosPagosRead:
    datos = _obtener_datos(service, parametros)
    return ReporteCobrosPagosRead.model_validate(datos)


@router.get("/cobros-pagos/reporte.pdf", response_class=Response)
def descargar_reporte_cobros_pagos(
    service: ServiceDep,
    _: SoloAdmin,
    parametros: ParametrosDep,
) -> Response:
    datos = _obtener_datos(service, parametros)
    contenido = generar_pdf_reporte_cobros_pagos(datos)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; filename="reporte-cobros-pagos.pdf"'
            )
        },
    )
