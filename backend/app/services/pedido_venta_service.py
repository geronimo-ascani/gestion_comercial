from decimal import Decimal

from psycopg import errors

from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.pedido_venta_repository import (
    PedidoVentaRepository,
    PedidoVentaRow,
)
from app.repositories.producto_repository import ProductoRepository, ProductoRow
from app.schemas.pedidos_venta import PedidoVentaInput
from app.services.venta_calculos import (
    VentaImporteInvalido,
    VentaLinea,
    calcular_linea_venta,
)

_MAX_IMPORTE = Decimal("999999999999.99")
_TRANSICIONES = {
    "pendiente": "proceso",
    "proceso": "enviado",
    "enviado": "entregado",
}


class PedidoVentaError(Exception):
    pass


class PedidoVentaNoEncontrado(PedidoVentaError):
    pass


class PedidoVentaDatosInvalidos(PedidoVentaError):
    pass


class PedidoVentaStockInsuficiente(PedidoVentaError):
    pass


class PedidoVentaEstadoInvalido(PedidoVentaError):
    pass


class PedidoVentaService:
    def __init__(
        self,
        repo: PedidoVentaRepository,
        productos: ProductoRepository,
        movimientos: MovimientoInventarioRepository,
    ) -> None:
        self._repo = repo
        self._productos = productos
        self._movimientos = movimientos

    def listar(
        self,
        estado_envio: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PedidoVentaRow]:
        return self._repo.listar(estado_envio, q, limit, offset)

    def obtener(self, id_pedido_cliente: str) -> PedidoVentaRow:
        pedido = self._repo.obtener(id_pedido_cliente)
        if pedido is None:
            raise PedidoVentaNoEncontrado(id_pedido_cliente)
        return pedido

    def crear(self, datos: PedidoVentaInput) -> PedidoVentaRow:
        try:
            with self._repo.transaction():
                if not self._repo.cliente_existe(datos.id_cliente):
                    raise PedidoVentaDatosInvalidos(
                        f"No existe el cliente '{datos.id_cliente}'"
                    )

                productos = self._bloquear_productos(
                    [item.id_producto for item in datos.items],
                    incluir_dados_de_baja=False,
                )
                lineas = self._calcular_lineas(datos, productos)
                total = sum(
                    (linea["subtotal"] for linea in lineas), Decimal("0")
                )

                for item in datos.items:
                    producto = self._aplicar_delta_stock(
                        item.id_producto, -item.cantidad, solo_activos=True
                    )
                    if producto is None:
                        raise PedidoVentaStockInsuficiente(
                            f"Stock insuficiente para el producto "
                            f"'{item.id_producto}'"
                        )

                id_pedido = self._repo.crear(
                    self._datos_cabecera(datos, total)
                )
                self._repo.crear_items(id_pedido, lineas)
                for linea in lineas:
                    self._movimientos.crear_venta(
                        id_pedido,
                        linea["id_producto"],
                        linea["cantidad"],
                    )
                return self._obtener_despues_de_mutacion(id_pedido)
        except errors.ForeignKeyViolation as exc:
            raise PedidoVentaDatosInvalidos(
                "El cliente o uno de los productos ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PedidoVentaDatosInvalidos(
                "Los datos del pedido de venta no son válidos"
            ) from exc

    def actualizar(
        self, id_pedido_cliente: str, datos: PedidoVentaInput
    ) -> PedidoVentaRow:
        try:
            with self._repo.transaction():
                pedido = self._repo.obtener(id_pedido_cliente, bloquear=True)
                if pedido is None:
                    raise PedidoVentaNoEncontrado(id_pedido_cliente)
                if pedido["estado_envio"] != "pendiente":
                    raise PedidoVentaEstadoInvalido(
                        "Solo se pueden editar pedidos pendientes"
                    )
                if not self._repo.cliente_existe(datos.id_cliente):
                    raise PedidoVentaDatosInvalidos(
                        f"No existe el cliente '{datos.id_cliente}'"
                    )

                cantidades_actuales = {
                    item["id_producto"]: item["cantidad"]
                    for item in pedido["items"]
                }
                cantidades_nuevas = {
                    item.id_producto: item.cantidad for item in datos.items
                }
                ids_producto = sorted(
                    set(cantidades_actuales) | set(cantidades_nuevas)
                )
                productos = self._bloquear_productos(
                    ids_producto,
                    incluir_dados_de_baja=True,
                )
                for id_producto in ids_producto:
                    delta_cantidad = (
                        cantidades_nuevas.get(id_producto, Decimal("0"))
                        - cantidades_actuales.get(id_producto, Decimal("0"))
                    )
                    producto = productos[id_producto]
                    if delta_cantidad > 0 and not producto["estado"]:
                        raise PedidoVentaDatosInvalidos(
                            f"El producto '{id_producto}' está dado de baja"
                        )

                lineas = self._calcular_lineas(datos, productos)
                total = sum(
                    (linea["subtotal"] for linea in lineas), Decimal("0")
                )
                if total > _MAX_IMPORTE:
                    raise PedidoVentaDatosInvalidos(
                        "El total excede el máximo permitido"
                    )

                deltas_stock: dict[str, Decimal] = {}
                for id_producto in ids_producto:
                    delta_stock = (
                        cantidades_actuales.get(id_producto, Decimal("0"))
                        - cantidades_nuevas.get(id_producto, Decimal("0"))
                    )
                    if delta_stock == 0:
                        continue
                    actualizado = self._aplicar_delta_stock(
                        id_producto, delta_stock
                    )
                    if actualizado is None:
                        raise PedidoVentaStockInsuficiente(
                            f"Stock insuficiente para el producto "
                            f"'{id_producto}'"
                        )
                    deltas_stock[id_producto] = delta_stock

                self._repo.reemplazar(
                    id_pedido_cliente,
                    self._datos_cabecera(datos, total),
                    lineas,
                )
                for id_producto, delta_stock in deltas_stock.items():
                    if delta_stock < 0:
                        self._movimientos.crear_venta(
                            id_pedido_cliente, id_producto, -delta_stock
                        )
                    else:
                        self._movimientos.crear_devolucion(
                            id_pedido_cliente, id_producto, delta_stock
                        )
                return self._obtener_despues_de_mutacion(id_pedido_cliente)
        except errors.ForeignKeyViolation as exc:
            raise PedidoVentaDatosInvalidos(
                "El cliente o uno de los productos ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PedidoVentaDatosInvalidos(
                "Los datos del pedido de venta no son válidos"
            ) from exc

    def avanzar_estado(
        self, id_pedido_cliente: str, estado_nuevo: str
    ) -> PedidoVentaRow:
        with self._repo.transaction():
            pedido = self._repo.obtener(id_pedido_cliente, bloquear=True)
            if pedido is None:
                raise PedidoVentaNoEncontrado(id_pedido_cliente)

            estado_actual = pedido["estado_envio"]
            if estado_actual == estado_nuevo:
                return pedido
            if _TRANSICIONES.get(estado_actual) != estado_nuevo:
                raise PedidoVentaEstadoInvalido(
                    f"No se puede cambiar el pedido de '{estado_actual}' "
                    f"a '{estado_nuevo}'"
                )
            if not self._repo.actualizar_estado(
                id_pedido_cliente, estado_actual, estado_nuevo
            ):
                raise PedidoVentaEstadoInvalido(
                    "El pedido cambió de estado y no pudo actualizarse"
                )
            return self._obtener_despues_de_mutacion(id_pedido_cliente)

    def cancelar(self, id_pedido_cliente: str) -> PedidoVentaRow:
        with self._repo.transaction():
            pedido = self._repo.obtener(id_pedido_cliente, bloquear=True)
            if pedido is None:
                raise PedidoVentaNoEncontrado(id_pedido_cliente)
            if pedido["estado_envio"] == "cancelado":
                return pedido
            if pedido["estado_envio"] == "entregado":
                raise PedidoVentaEstadoInvalido(
                    "No se puede cancelar un pedido ya entregado"
                )

            for item in sorted(pedido["items"], key=lambda row: row["id_producto"]):
                producto = self._aplicar_delta_stock(
                    item["id_producto"], item["cantidad"]
                )
                if producto is None:
                    raise PedidoVentaDatosInvalidos(
                        f"No se pudo restaurar el stock del producto "
                        f"'{item['id_producto']}'"
                    )
                self._movimientos.crear_devolucion(
                    id_pedido_cliente,
                    item["id_producto"],
                    item["cantidad"],
                )

            if not self._repo.marcar_cancelado(id_pedido_cliente):
                raise PedidoVentaEstadoInvalido(
                    "El pedido cambió de estado y no pudo cancelarse"
                )
            return self._obtener_despues_de_mutacion(id_pedido_cliente)

    def _bloquear_productos(
        self, ids_producto: list[str], incluir_dados_de_baja: bool
    ) -> dict[str, ProductoRow]:
        productos: dict[str, ProductoRow] = {}
        for id_producto in sorted(set(ids_producto)):
            producto = self._productos.bloquear_para_pedido_venta(
                id_producto,
                incluir_dados_de_baja=incluir_dados_de_baja,
            )
            if producto is None:
                raise PedidoVentaDatosInvalidos(
                    f"El producto '{id_producto}' no existe o está dado de baja"
                )
            productos[id_producto] = producto
        return productos

    def _aplicar_delta_stock(
        self,
        id_producto: str,
        delta: Decimal,
        solo_activos: bool = False,
    ) -> ProductoRow | None:
        try:
            if solo_activos:
                return self._productos.aplicar_delta_stock(id_producto, delta)
            return self._productos.aplicar_delta_stock_sistema(id_producto, delta)
        except errors.NumericValueOutOfRange as exc:
            raise PedidoVentaDatosInvalidos(
                "El stock resultante excede el máximo permitido"
            ) from exc

    def _calcular_lineas(
        self,
        datos: PedidoVentaInput,
        productos: dict[str, ProductoRow],
    ) -> list[VentaLinea]:
        lineas: list[VentaLinea] = []
        total = Decimal("0")
        for item in datos.items:
            producto = productos[item.id_producto]
            try:
                linea = calcular_linea_venta(
                    item.id_producto,
                    item.cantidad,
                    item.descuento_producto,
                    datos.descuento_compra,
                    producto["precio_venta"],
                    producto["alicuota_porcentaje"],
                    producto["alicuota_tipo_iva"],
                )
            except VentaImporteInvalido as exc:
                raise PedidoVentaDatosInvalidos(str(exc)) from exc
            lineas.append(linea)
            total += linea["subtotal"]
        if total > _MAX_IMPORTE:
            raise PedidoVentaDatosInvalidos(
                "El total excede el máximo permitido"
            )
        return lineas

    @staticmethod
    def _datos_cabecera(
        datos: PedidoVentaInput, total: Decimal
    ) -> dict[str, object]:
        return {
            "id_cliente": datos.id_cliente,
            "descuento_compra": datos.descuento_compra,
            "entrega_altura": datos.entrega_altura,
            "entrega_calle": datos.entrega_calle,
            "entrega_cp": datos.entrega_cp,
            "entrega_depto": datos.entrega_depto,
            "entrega_localidad": datos.entrega_localidad,
            "entrega_provincia": datos.entrega_provincia,
            "saldo_pendiente": total,
            "total": total,
            "id_presupuesto_cliente": None,
        }

    def _obtener_despues_de_mutacion(
        self, id_pedido_cliente: str
    ) -> PedidoVentaRow:
        pedido = self._repo.obtener(id_pedido_cliente)
        if pedido is None:
            raise PedidoVentaError(
                "No se pudo recuperar el pedido de venta actualizado"
            )
        return pedido
