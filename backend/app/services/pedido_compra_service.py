from decimal import ROUND_HALF_UP, Decimal

from psycopg import errors

from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.pedido_compra_repository import (
    PedidoCompraRepository,
    PedidoCompraRow,
)
from app.repositories.producto_repository import ProductoRepository
from app.schemas.pedidos_compra import PedidoCompraCreate

_CENTAVOS = Decimal("0.01")
_MAX_IMPORTE = Decimal("999999999999.99")


class PedidoCompraError(Exception):
    pass


class PedidoCompraNoEncontrado(PedidoCompraError):
    pass


class PedidoCompraDatosInvalidos(PedidoCompraError):
    pass


class PedidoCompraEstadoInvalido(PedidoCompraError):
    pass


class PedidoCompraService:
    def __init__(
        self,
        repo: PedidoCompraRepository,
        productos: ProductoRepository,
        movimientos: MovimientoInventarioRepository,
    ) -> None:
        self._repo = repo
        self._productos = productos
        self._movimientos = movimientos

    def listar(
        self,
        estado: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PedidoCompraRow]:
        return self._repo.listar(estado, q, limit, offset)

    def obtener(self, id_pedido_proveedor: str) -> PedidoCompraRow:
        pedido = self._repo.obtener(id_pedido_proveedor)
        if pedido is None:
            raise PedidoCompraNoEncontrado(id_pedido_proveedor)
        return pedido

    def crear(self, datos: PedidoCompraCreate, id_empleado: str) -> PedidoCompraRow:
        try:
            with self._repo.transaction():
                if not self._repo.proveedor_existe(datos.id_proveedor):
                    raise PedidoCompraDatosInvalidos(
                        f"No existe el proveedor '{datos.id_proveedor}'"
                    )
                if not self._repo.medio_pago_existe(datos.id_medio_pago):
                    raise PedidoCompraDatosInvalidos(
                        f"No existe el medio de pago '{datos.id_medio_pago}'"
                    )

                items: list[dict[str, object]] = []
                total = Decimal("0")
                for item in datos.items:
                    producto = self._productos.obtener_activo_para_pedido(
                        item.id_producto
                    )
                    if producto is None:
                        raise PedidoCompraDatosInvalidos(
                            f"El producto '{item.id_producto}' no existe o está dado de baja"
                        )
                    subtotal_sin_redondear = item.cantidad * item.precio_unitario
                    if subtotal_sin_redondear > _MAX_IMPORTE:
                        raise PedidoCompraDatosInvalidos(
                            "El subtotal excede el máximo permitido"
                        )
                    subtotal = subtotal_sin_redondear.quantize(
                        _CENTAVOS,
                        rounding=ROUND_HALF_UP,
                    )
                    if subtotal > _MAX_IMPORTE:
                        raise PedidoCompraDatosInvalidos(
                            "El subtotal excede el máximo permitido"
                        )
                    total += subtotal
                    items.append(
                        {
                            "id_producto": item.id_producto,
                            "cantidad": item.cantidad,
                            "precio_unitario": item.precio_unitario,
                            "subtotal": subtotal,
                        }
                    )

                if total > _MAX_IMPORTE:
                    raise PedidoCompraDatosInvalidos(
                        "El total excede el máximo permitido"
                    )

                id_pedido = self._repo.crear(
                    datos.id_proveedor,
                    datos.id_medio_pago,
                    id_empleado,
                    total,
                )
                self._repo.crear_items(id_pedido, items)
                pedido = self._repo.obtener(id_pedido)
                if pedido is None:
                    raise PedidoCompraError(
                        "No se pudo recuperar el pedido recién creado"
                    )
                return pedido
        except errors.ForeignKeyViolation as exc:
            raise PedidoCompraDatosInvalidos(
                "El proveedor, medio de pago o producto ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PedidoCompraDatosInvalidos(
                "Los datos del pedido de compra no son válidos"
            ) from exc

    def recibir(self, id_pedido_proveedor: str) -> PedidoCompraRow:
        with self._repo.transaction():
            pedido = self._repo.obtener(id_pedido_proveedor, bloquear=True)
            if pedido is None:
                raise PedidoCompraNoEncontrado(id_pedido_proveedor)
            if pedido["estado"] == "recibida":
                return pedido
            if pedido["estado"] not in ("pendiente", "aprobada"):
                raise PedidoCompraEstadoInvalido(
                    "Solo se pueden recibir pedidos pendientes o aprobados"
                )

            for item in pedido["items"]:
                try:
                    producto = self._productos.aplicar_delta_stock_sistema(
                        item["id_producto"],
                        item["cantidad"],
                    )
                except errors.NumericValueOutOfRange as exc:
                    raise PedidoCompraDatosInvalidos(
                        "El stock resultante excede el máximo permitido"
                    ) from exc
                if producto is None:
                    raise PedidoCompraDatosInvalidos(
                        f"No se pudo actualizar el stock del producto "
                        f"'{item['id_producto']}'"
                    )
                self._movimientos.crear_compra(
                    id_pedido_proveedor,
                    item["id_producto"],
                    item["cantidad"],
                )

            if not self._repo.marcar_recibida(id_pedido_proveedor):
                raise PedidoCompraEstadoInvalido(
                    "El pedido cambió de estado y no pudo recibirse"
                )
            recibido = self._repo.obtener(id_pedido_proveedor)
            if recibido is None:
                raise PedidoCompraError(
                    "No se pudo recuperar el pedido recibido"
                )
            return recibido

    def cancelar(self, id_pedido_proveedor: str) -> PedidoCompraRow:
        with self._repo.transaction():
            pedido = self._repo.obtener(id_pedido_proveedor, bloquear=True)
            if pedido is None:
                raise PedidoCompraNoEncontrado(id_pedido_proveedor)
            if pedido["estado"] == "cancelada":
                return pedido
            if pedido["estado"] not in ("pendiente", "aprobada"):
                raise PedidoCompraEstadoInvalido(
                    "Solo se pueden cancelar pedidos pendientes o aprobados"
                )
            if not self._repo.marcar_cancelada(id_pedido_proveedor):
                raise PedidoCompraEstadoInvalido(
                    "El pedido cambió de estado y no pudo cancelarse"
                )
            cancelado = self._repo.obtener(id_pedido_proveedor)
            if cancelado is None:
                raise PedidoCompraError(
                    "No se pudo recuperar el pedido cancelado"
                )
            return cancelado
