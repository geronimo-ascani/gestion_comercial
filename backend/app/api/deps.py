from typing import Annotated, Any

from fastapi import Depends
from psycopg import Connection

from app.core.db import get_db
from app.repositories.categoria_repository import CategoriaRepository
from app.services.categoria_service import CategoriaService


def get_categoria_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> CategoriaService:
    return CategoriaService(CategoriaRepository(db))
