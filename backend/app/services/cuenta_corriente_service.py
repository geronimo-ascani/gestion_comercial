"""Orquestación de cuentas corrientes de clientes y proveedores."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Sequence

from app.repositories.cuenta_corriente_repository import (
    CuentaCorrienteRepository,
)
from app.services.cuentas_corrientes_calculos import (
    construir_resumenes,
    resolver_rango,
    saldos_por_entidad,
    totalizar,
)


class CuentaCorrienteError(Exception):
    pass


class CuentaCorrienteNoEncontrado(CuentaCorrienteError):
    pass


class CuentaCorrienteService:
    def __init__(self, repo: CuentaCorrienteRepository) -> None:
        self._repo = repo

    @staticmethod
    def _resumen_cliente(resumen: dict[str, Any]) -> dict[str, Any]:
        return {
            "id_cliente": resumen["id"],
            "nombre": resumen["nombre"],
            "apellido": resumen["apellido"],
            "dni_cuit": resumen["documento"],
            "saldo_inicial": resumen["saldo_inicial"],
            "total_cargo": resumen["total_cargo"],
            "total_abono": resumen["total_abono"],
            "saldo_final": resumen["saldo_final"],
            "cantidad_comprobantes": resumen["cantidad_documentos"],
            "cantidad_pagos": resumen["cantidad_pagos"],
            "ultima_actividad": resumen["ultima_actividad"],
        }

    @staticmethod
    def _resumen_proveedor(resumen: dict[str, Any]) -> dict[str, Any]:
        return {
            "id_proveedor": resumen["id"],
            "razon_social": resumen["nombre"],
            "cuit": resumen["documento"],
            "saldo_inicial": resumen["saldo_inicial"],
            "total_cargo": resumen["total_cargo"],
            "total_abono": resumen["total_abono"],
            "saldo_final": resumen["saldo_final"],
            "cantidad_facturas": resumen["cantidad_documentos"],
            "cantidad_pagos": resumen["cantidad_pagos"],
            "ultima_actividad": resumen["ultima_actividad"],
        }

    def _obtener_clientes(
        self, desde: date | None, hasta: date | None, id_cliente: str | None
    ) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
        desde, hasta = resolver_rango(desde, hasta)
        if id_cliente and not self._repo.cliente_existe(id_cliente):
            raise CuentaCorrienteNoEncontrado(id_cliente)
        ids = [id_cliente] if id_cliente else None
        entidades = self._repo.listar_clientes(ids)
        movimientos = self._repo.listar_movimientos_clientes(hasta, ids)
        resumenes, por_id = construir_resumenes(
            entidades, movimientos, desde, hasta
        )
        datos = {
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime.now(timezone.utc),
            "parametros": {
                "desde": desde,
                "hasta": hasta,
                "id_cliente": id_cliente,
            },
            "totales": totalizar(resumenes),
            "clientes": [self._resumen_cliente(item) for item in resumenes],
        }
        return datos, por_id

    def _obtener_proveedores(
        self,
        desde: date | None,
        hasta: date | None,
        id_proveedor: str | None,
    ) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
        desde, hasta = resolver_rango(desde, hasta)
        if id_proveedor and not self._repo.proveedor_existe(id_proveedor):
            raise CuentaCorrienteNoEncontrado(id_proveedor)
        ids = [id_proveedor] if id_proveedor else None
        entidades = self._repo.listar_proveedores(ids)
        movimientos = self._repo.listar_movimientos_proveedores(hasta, ids)
        resumenes, por_id = construir_resumenes(
            entidades, movimientos, desde, hasta
        )
        datos = {
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime.now(timezone.utc),
            "parametros": {
                "desde": desde,
                "hasta": hasta,
                "id_proveedor": id_proveedor,
            },
            "totales": totalizar(resumenes),
            "proveedores": [self._resumen_proveedor(item) for item in resumenes],
        }
        return datos, por_id

    def listar_clientes(
        self,
        desde: date | None = None,
        hasta: date | None = None,
        id_cliente: str | None = None,
    ) -> dict[str, Any]:
        datos, _ = self._obtener_clientes(desde, hasta, id_cliente)
        return datos

    def listar_proveedores(
        self,
        desde: date | None = None,
        hasta: date | None = None,
        id_proveedor: str | None = None,
    ) -> dict[str, Any]:
        datos, _ = self._obtener_proveedores(desde, hasta, id_proveedor)
        return datos

    def obtener_cliente(
        self, id_cliente: str, desde: date | None, hasta: date | None
    ) -> dict[str, Any]:
        datos, movimientos = self._obtener_clientes(
            desde, hasta, id_cliente
        )
        resumen = next(
            (item for item in datos["clientes"] if item["id_cliente"] == id_cliente),
            None,
        )
        if resumen is None:
            raise CuentaCorrienteNoEncontrado(id_cliente)
        return {
            "desde": datos["desde"],
            "hasta": datos["hasta"],
            "generado_en": datos["generado_en"],
            "parametros": datos["parametros"],
            "cliente": {
                **resumen,
                "movimientos": movimientos.get(id_cliente, []),
            },
        }

    def obtener_proveedor(
        self, id_proveedor: str, desde: date | None, hasta: date | None
    ) -> dict[str, Any]:
        datos, movimientos = self._obtener_proveedores(
            desde, hasta, id_proveedor
        )
        resumen = next(
            (
                item
                for item in datos["proveedores"]
                if item["id_proveedor"] == id_proveedor
            ),
            None,
        )
        if resumen is None:
            raise CuentaCorrienteNoEncontrado(id_proveedor)
        return {
            "desde": datos["desde"],
            "hasta": datos["hasta"],
            "generado_en": datos["generado_en"],
            "parametros": datos["parametros"],
            "proveedor": {
                **resumen,
                "movimientos": movimientos.get(id_proveedor, []),
            },
        }

    def saldos_clientes(self, ids: Sequence[str]) -> dict[str, Decimal]:
        """Saldo histórico para reemplazar el campo legado de clientes."""
        if not ids:
            return {}
        movimientos = self._repo.listar_movimientos_clientes(ids=list(ids))
        return saldos_por_entidad(movimientos)

    def saldos_proveedores(self, ids: Sequence[str]) -> dict[str, Decimal]:
        """Saldo histórico para reemplazar el campo legado de proveedores."""
        if not ids:
            return {}
        movimientos = self._repo.listar_movimientos_proveedores(ids=list(ids))
        return saldos_por_entidad(movimientos)
