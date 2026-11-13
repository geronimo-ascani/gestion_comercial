from datetime import date
from decimal import Decimal

from psycopg import errors

from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.presupuesto_repository import (
    PresupuestoRepository,
    PresupuestoRow,
)
from app.repositories.pedido_venta_repository import (
    PedidoVentaRepository,
    PedidoVentaRow,
)
from app.repositories.producto_repository import ProductoRepository, ProductoRow
from app.schemas.presupuestos import (
    PresupuestoConversionInput,
    PresupuestoInput,
)
from app.services.venta_calculos import (
    VentaImporteInvalido,
    VentaLinea,
    calcular_linea_venta,
)

_MAX_IMPORTE = Decimal("999999999999.99")


class PresupuestoError(Exception):
    pass


class PresupuestoNoEncontrado(PresupuestoError):
    pass


class PresupuestoDatosInvalidos(PresupuestoError):
    pass


class PresupuestoEstadoInvalido(PresupuestoError):
    pass


class PresupuestoStockInsuficiente(PresupuestoError):
    pass


class PresupuestoService:
    def __init__(
        self,
        repo: PresupuestoRepository,
        pedidos: PedidoVentaRepository,
        productos: ProductoRepository,
        movimientos: MovimientoInventarioRepository,
    ) -> None:
        self._repo = repo
        self._pedidos = pedidos
        self._productos = productos
        self._movimientos = movimientos

    def listar(
        self,
        estado: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PresupuestoRow]:
        return self._repo.listar(estado, q, limit, offset)

    def obtener(self, id_presupuesto_cliente: str) -> PresupuestoRow:
        with self._repo.transaction():
            self._repo.marcar_vencido(id_presupuesto_cliente)
            presupuesto = self._repo.obtener(id_presupuesto_cliente)
        if presupuesto is None:
            raise PresupuestoNoEncontrado(id_presupuesto_cliente)
        return presupuesto

    def crear(self, datos: PresupuestoInput) -> PresupuestoRow:
        if datos.fecha_vencimiento < date.today():
            raise PresupuestoDatosInvalidos(
                "La fecha de vencimiento no puede estar en el pasado"
            )
        try:
            with self._repo.transaction():
                if not self._repo.cliente_existe(datos.id_cliente):
                    raise PresupuestoDatosInvalidos(
                        f"No existe el cliente '{datos.id_cliente}'"
                    )
                productos = self._bloquear_productos(
                    [item.id_producto for item in datos.items]
                )
                items = self._calcular_items(datos, productos)
                total = self._total(items)
                id_presupuesto = self._repo.crear(
                    self._datos_cabecera(datos),
                    total,
                )
                self._repo.crear_items(id_presupuesto, items)
                presupuesto = self._repo.obtener(id_presupuesto)
                if presupuesto is None:
                    raise PresupuestoError(
                        "No se pudo recuperar el presupuesto recién creado"
                    )
                return presupuesto
        except errors.ForeignKeyViolation as exc:
            raise PresupuestoDatosInvalidos(
                "El cliente o uno de los productos ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PresupuestoDatosInvalidos(
                "Los datos del presupuesto no son válidos"
            ) from exc
        except errors.NumericValueOutOfRange as exc:
            raise PresupuestoDatosInvalidos(
                "Un valor numérico del presupuesto excede el máximo permitido"
            ) from exc

    def actualizar(
        self, id_presupuesto_cliente: str, datos: PresupuestoInput
    ) -> PresupuestoRow:
        self._sincronizar_vencimiento(id_presupuesto_cliente)
        try:
            with self._repo.transaction():
                presupuesto = self._obtener_bloqueado(id_presupuesto_cliente)
                self._validar_editable(presupuesto)
                if not self._repo.cliente_existe(datos.id_cliente):
                    raise PresupuestoDatosInvalidos(
                        f"No existe el cliente '{datos.id_cliente}'"
                    )
                productos = self._bloquear_productos(
                    [item.id_producto for item in datos.items]
                )
                items = self._calcular_items(datos, productos)
                total = self._total(items)
                if not self._repo.reemplazar(
                    id_presupuesto_cliente,
                    self._datos_cabecera(datos),
                    total,
                    items,
                ):
                    raise PresupuestoEstadoInvalido(
                        "Solo se pueden editar presupuestos pendientes"
                    )
                actualizado = self._repo.obtener(id_presupuesto_cliente)
                if actualizado is None:
                    raise PresupuestoError(
                        "No se pudo recuperar el presupuesto actualizado"
                    )
                return actualizado
        except errors.ForeignKeyViolation as exc:
            raise PresupuestoDatosInvalidos(
                "El cliente o uno de los productos ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PresupuestoDatosInvalidos(
                "Los datos del presupuesto no son válidos"
            ) from exc
        except errors.NumericValueOutOfRange as exc:
            raise PresupuestoDatosInvalidos(
                "Un valor numérico del presupuesto excede el máximo permitido"
            ) from exc

    def aprobar(self, id_presupuesto_cliente: str) -> PresupuestoRow:
        self._sincronizar_vencimiento(id_presupuesto_cliente)
        with self._repo.transaction():
            presupuesto = self._obtener_bloqueado(id_presupuesto_cliente)
            self._validar_no_vencido(id_presupuesto_cliente, presupuesto)
            if presupuesto["estado"] != "pendiente":
                raise PresupuestoEstadoInvalido(
                    "Solo se pueden aprobar presupuestos pendientes"
                )
            if not self._repo.marcar_aprobado(id_presupuesto_cliente):
                raise PresupuestoEstadoInvalido(
                    "El presupuesto cambió de estado y no pudo aprobarse"
                )
            aprobado = self._repo.obtener(id_presupuesto_cliente)
            if aprobado is None:
                raise PresupuestoError(
                    "No se pudo recuperar el presupuesto aprobado"
                )
            return aprobado

    def eliminar(self, id_presupuesto_cliente: str) -> None:
        self._sincronizar_vencimiento(id_presupuesto_cliente)
        with self._repo.transaction():
            presupuesto = self._obtener_bloqueado(id_presupuesto_cliente)
            self._validar_editable(presupuesto)
            if not self._repo.eliminar(id_presupuesto_cliente):
                raise PresupuestoEstadoInvalido(
                    "Solo se pueden eliminar presupuestos pendientes"
                )

    def convertir(
        self,
        id_presupuesto_cliente: str,
        datos: PresupuestoConversionInput,
    ) -> PedidoVentaRow:
        self._sincronizar_vencimiento(id_presupuesto_cliente)
        try:
            with self._repo.transaction():
                presupuesto = self._obtener_bloqueado(id_presupuesto_cliente)
                self._validar_no_vencido(id_presupuesto_cliente, presupuesto)
                if presupuesto["estado"] == "convertido":
                    raise PresupuestoEstadoInvalido(
                        "El presupuesto ya fue convertido"
                    )
                if presupuesto["estado"] != "aprobado":
                    raise PresupuestoEstadoInvalido(
                        "Solo se pueden convertir presupuestos aprobados"
                    )

                items = presupuesto["items"]
                self._bloquear_productos(
                    [item["id_producto"] for item in items]
                )
                total = presupuesto["total"]
                cabecera = {
                    "id_cliente": presupuesto["id_cliente"],
                    "descuento_compra": presupuesto["descuento_compra"],
                    "entrega_provincia": datos.entrega_provincia,
                    "entrega_localidad": datos.entrega_localidad,
                    "entrega_calle": datos.entrega_calle,
                    "entrega_altura": datos.entrega_altura,
                    "entrega_cp": datos.entrega_cp,
                    "entrega_depto": datos.entrega_depto,
                    "saldo_pendiente": total,
                    "total": total,
                    "id_presupuesto_cliente": id_presupuesto_cliente,
                }

                for item in items:
                    producto = self._productos.aplicar_delta_stock(
                        item["id_producto"],
                        -item["cantidad"],
                    )
                    if producto is None:
                        raise PresupuestoStockInsuficiente(
                            f"Stock insuficiente para el producto "
                            f"'{item['id_producto']}'"
                        )

                id_pedido = self._pedidos.crear(cabecera)
                self._pedidos.crear_items(id_pedido, items)
                for item in items:
                    self._movimientos.crear_venta(
                        id_pedido,
                        item["id_producto"],
                        item["cantidad"],
                    )
                if not self._repo.marcar_convertido(id_presupuesto_cliente):
                    raise PresupuestoEstadoInvalido(
                        "El presupuesto cambió de estado y no pudo convertirse"
                    )
                pedido = self._pedidos.obtener(id_pedido)
                if pedido is None:
                    raise PresupuestoError(
                        "No se pudo recuperar el pedido convertido"
                    )
                return pedido
        except errors.ForeignKeyViolation as exc:
            raise PresupuestoDatosInvalidos(
                "El presupuesto, cliente o producto ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PresupuestoDatosInvalidos(
                "Los datos del pedido convertido no son válidos"
            ) from exc
        except errors.NumericValueOutOfRange as exc:
            raise PresupuestoDatosInvalidos(
                "El stock resultante excede el máximo permitido"
            ) from exc

    def _obtener_bloqueado(
        self, id_presupuesto_cliente: str
    ) -> PresupuestoRow:
        presupuesto = self._repo.obtener(id_presupuesto_cliente, bloquear=True)
        if presupuesto is None:
            raise PresupuestoNoEncontrado(id_presupuesto_cliente)
        return presupuesto

    def _sincronizar_vencimiento(self, id_presupuesto_cliente: str) -> None:
        with self._repo.transaction():
            self._repo.marcar_vencido(id_presupuesto_cliente)

    def _validar_no_vencido(
        self,
        id_presupuesto_cliente: str,
        presupuesto: PresupuestoRow,
    ) -> None:
        if (
            presupuesto["estado"] == "vencido"
            or presupuesto["fecha_vencimiento"] < date.today()
        ):
            self._repo.marcar_vencido(id_presupuesto_cliente)
            raise PresupuestoEstadoInvalido(
                "El presupuesto está vencido; debe emitirse uno nuevo"
            )

    def _validar_editable(self, presupuesto: PresupuestoRow) -> None:
        if presupuesto["estado"] != "pendiente":
            raise PresupuestoEstadoInvalido(
                "Solo se pueden editar o eliminar presupuestos pendientes"
            )

    def _bloquear_productos(
        self, ids_producto: list[str]
    ) -> dict[str, ProductoRow]:
        productos: dict[str, ProductoRow] = {}
        for id_producto in sorted(set(ids_producto)):
            producto = self._productos.bloquear_para_pedido_venta(
                id_producto,
                incluir_dados_de_baja=False,
            )
            if producto is None:
                raise PresupuestoDatosInvalidos(
                    f"El producto '{id_producto}' no existe o está dado de baja"
                )
            productos[id_producto] = producto
        return productos

    @staticmethod
    def _datos_cabecera(datos: PresupuestoInput) -> dict[str, object]:
        return {
            "id_cliente": datos.id_cliente,
            "fecha_muestra": datos.fecha_muestra,
            "fecha_vencimiento": datos.fecha_vencimiento,
            "descuento_compra": datos.descuento_compra,
        }

    @staticmethod
    def _calcular_items(
        datos: PresupuestoInput, productos: dict[str, ProductoRow]
    ) -> list[VentaLinea]:
        items: list[VentaLinea] = []
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
                raise PresupuestoDatosInvalidos(str(exc)) from exc
            items.append(linea)
        return items

    @staticmethod
    def _total(items: list[VentaLinea]) -> Decimal:
        total = sum((item["subtotal"] for item in items), Decimal("0"))
        if total > _MAX_IMPORTE:
            raise PresupuestoDatosInvalidos(
                "El total excede el máximo permitido"
            )
        return total
