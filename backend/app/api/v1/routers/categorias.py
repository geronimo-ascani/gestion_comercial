from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status

from app.api.deps import get_categoria_service
from app.schemas.catalogo import CategoriaCreate, CategoriaRead, CategoriaUpdate
from app.services.categoria_service import (
    CategoriaDuplicada,
    CategoriaEnUso,
    CategoriaError,
    CategoriaNoEncontrada,
    CategoriaService,
    CategoriaSinCambios,
)

router = APIRouter(prefix="/categorias", tags=["Categorías"])

ServiceDep = Annotated[CategoriaService, Depends(get_categoria_service)]
CategoriaId = Annotated[str, Path(min_length=1, max_length=20)]


def _error_http(exc: CategoriaError) -> HTTPException:
    if isinstance(exc, CategoriaNoEncontrada):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe la categoría '{exc.args[0]}'",
        )
    if isinstance(exc, CategoriaDuplicada):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una categoría con el nombre '{exc.args[0]}'",
        )
    if isinstance(exc, CategoriaEnUso):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La categoría tiene productos asociados y no se puede eliminar",
        )
    if isinstance(exc, CategoriaSinCambios):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No se enviaron campos para actualizar",
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No se pudo procesar la operación",
    )


@router.get("", response_model=list[CategoriaRead])
def listar_categorias(
    service: ServiceDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CategoriaRead]:
    return [
        CategoriaRead.model_validate(categoria)
        for categoria in service.listar(q, limit, offset)
    ]


@router.get("/{id_categoria}", response_model=CategoriaRead)
def obtener_categoria(service: ServiceDep, id_categoria: CategoriaId) -> CategoriaRead:
    try:
        categoria = service.obtener(id_categoria)
    except CategoriaError as exc:
        raise _error_http(exc) from exc
    return CategoriaRead.model_validate(categoria)


@router.post("", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(datos: CategoriaCreate, service: ServiceDep) -> CategoriaRead:
    try:
        categoria = service.crear(datos.nombre)
    except CategoriaError as exc:
        raise _error_http(exc) from exc
    return CategoriaRead.model_validate(categoria)


@router.patch("/{id_categoria}", response_model=CategoriaRead)
def actualizar_categoria(
    datos: CategoriaUpdate, service: ServiceDep, id_categoria: CategoriaId
) -> CategoriaRead:
    try:
        categoria = service.actualizar(id_categoria, datos.nombre)
    except CategoriaError as exc:
        raise _error_http(exc) from exc
    return CategoriaRead.model_validate(categoria)


@router.delete("/{id_categoria}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(service: ServiceDep, id_categoria: CategoriaId) -> Response:
    try:
        service.eliminar(id_categoria)
    except CategoriaError as exc:
        raise _error_http(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
