from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, Mapping, Sequence, TypedDict

_CENTAVOS = Decimal("0.01")
_MILESIMAS = Decimal("0.001")
_PORCENTAJE = Decimal("0.01")
_CIEN = Decimal("100")
_CERO = Decimal("0")

Granularidad = Literal["diario", "semanal", "mensual", "anual"]
Orden = Literal["asc", "desc"]
Periodo = Literal["hoy", "7d", "mes", "trimestre", "año"]


class AnaliticaDatosInvalidos(Exception):
    pass


class ItemVentaAnalitica(TypedDict):
    id_producto: str
    nombre: str
    id_categoria: str
    nombre_categoria: str
    cantidad: Decimal
    neto: Decimal
    subtotal: Decimal
    costo_unitario: Decimal


class VentaAnalitica(TypedDict):
    id_pedido: str
    fecha_hora: datetime
    id_cliente: str
    cliente_nombre: str
    total: Decimal
    estado: str
    items: Sequence[ItemVentaAnalitica]


class ItemCompraAnalitica(TypedDict):
    id_producto: str
    nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    subtotal: Decimal


class CompraAnalitica(TypedDict):
    id_pedido: str
    fecha: date
    fecha_recepcion: date | None
    id_proveedor: str
    proveedor_nombre: str
    total: Decimal
    estado: str
    items: Sequence[ItemCompraAnalitica]


class ProductoInventario(TypedDict):
    id_producto: str
    nombre: str
    stock: Decimal
    costo_unitario: Decimal


class PagoAnalitica(TypedDict):
    id_medio_pago: str
    medio_pago: str
    monto: Decimal
    estado: str


class KpisAnalitica(TypedDict):
    ventas: Decimal
    compras: Decimal
    gastos: Decimal
    neto: Decimal
    margen_pct: Decimal
    costo_ventas: Decimal
    margen_bruto: Decimal
    margen_bruto_pct: Decimal


class PuntoTendencia(TypedDict):
    inicio: date
    fin: date
    ventas: Decimal
    gastos: Decimal


class AovUpt(TypedDict):
    aov: Decimal
    upt: Decimal


class PuntoAovUpt(TypedDict):
    inicio: date
    fin: date
    aov: Decimal
    upt: Decimal


class PuntoNuevosRecurrentes(TypedDict):
    inicio: date
    fin: date
    nuevos: Decimal
    recurrentes: Decimal


class RankingProducto(TypedDict):
    id_producto: str
    nombre: str
    cantidad: Decimal
    venta_neta: Decimal
    costo: Decimal
    margen: Decimal
    margen_pct: Decimal


class RankingCliente(TypedDict):
    id_cliente: str
    nombre: str
    pedidos: int
    facturacion: Decimal


class RankingProveedor(TypedDict):
    id_proveedor: str
    nombre: str
    pedidos: int
    volumen_compra: Decimal
    unidades: Decimal
    precio_promedio: Decimal
    entrega_promedio_dias: Decimal | None


class PrecioProveedor(TypedDict):
    id_proveedor: str
    proveedor: str
    precio_minimo: Decimal
    precio_promedio: Decimal
    ultima_compra: date


class ComparativaPrecio(TypedDict):
    id_producto: str
    nombre: str
    proveedores: list[PrecioProveedor]


class InventarioInmovilizado(TypedDict):
    id_producto: str
    nombre: str
    stock: Decimal
    costo_unitario: Decimal
    capital: Decimal
    dias_sin_venta: int | None


class MargenCategoria(TypedDict):
    id_categoria: str
    nombre: str
    venta_neta: Decimal
    costo: Decimal
    margen: Decimal
    margen_pct: Decimal


class MapaCalor(TypedDict):
    dias: list[int]
    horas: list[int]
    valores: list[list[Decimal]]


class VentaMetodoPago(TypedDict):
    id_medio_pago: str
    medio_pago: str
    monto: Decimal


class _AcumuladoProducto(TypedDict):
    nombre: str
    cantidad: Decimal
    venta_neta: Decimal
    costo: Decimal


class _AcumuladoCliente(TypedDict):
    nombre: str
    pedidos: int
    facturacion: Decimal


class _AcumuladoProveedor(TypedDict):
    nombre: str
    pedidos: int
    volumen: Decimal
    unidades: Decimal
    dias_entrega: int
    entregas: int


class _AcumuladoPrecio(TypedDict):
    proveedor: str
    precio_minimo: Decimal
    importe: Decimal
    unidades: Decimal
    ultima_compra: date


class _AcumuladoCategoria(TypedDict):
    nombre: str
    venta_neta: Decimal
    costo: Decimal


class _AcumuladoMedioPago(TypedDict):
    medio_pago: str
    monto: Decimal


def _importe(valor: Decimal) -> Decimal:
    return valor.quantize(_CENTAVOS, rounding=ROUND_HALF_UP)


def _cantidad(valor: Decimal) -> Decimal:
    return valor.quantize(_MILESIMAS, rounding=ROUND_HALF_UP)


def _porcentaje(valor: Decimal) -> Decimal:
    return valor.quantize(_PORCENTAJE, rounding=ROUND_HALF_UP)


def _pct(parte: Decimal, total: Decimal) -> Decimal:
    if total == 0:
        return Decimal("0.00")
    return _porcentaje(parte / total * _CIEN)


def _venta_vigente(venta: VentaAnalitica) -> bool:
    return venta["estado"] != "cancelado"


def _compra_vigente(compra: CompraAnalitica) -> bool:
    return compra["estado"] != "cancelada"


def _fecha_venta(venta: VentaAnalitica) -> date:
    return venta["fecha_hora"].date()


def _fecha_gasto(compra: CompraAnalitica) -> date:
    return compra["fecha_recepcion"] or compra["fecha"]


def rango_periodo(periodo: Periodo, referencia: date) -> tuple[date, date]:
    """Devuelve el rango inclusivo [desde, hasta] de un período de análisis."""
    if periodo == "hoy":
        return referencia, referencia
    if periodo == "7d":
        return referencia - timedelta(days=6), referencia
    if periodo == "mes":
        return referencia - timedelta(days=29), referencia
    if periodo == "trimestre":
        return referencia - timedelta(days=89), referencia
    if periodo == "año":
        return date(referencia.year, 1, 1), referencia
    raise AnaliticaDatosInvalidos(f"Período desconocido: {periodo}")


def calcular_kpis(
    ventas: Sequence[VentaAnalitica],
    compras: Sequence[CompraAnalitica],
    compras_recibidas: Sequence[CompraAnalitica] | None = None,
) -> KpisAnalitica:
    """KPIs del período. Ventas con IVA; gastos son compras recibidas.

    ``compras`` se imputa por fecha de pedido y ``compras_recibidas`` por
    fecha de recepción. Si no se recibe la segunda lista, los gastos se
    calculan sobre ``compras`` para conservar el comportamiento histórico.

    El margen bruto usa ventas netas (sin IVA) menos el costo actual de los
    productos vendidos, por lo que no debe compararse contra ``neto``.
    """
    ventas_vigentes = [venta for venta in ventas if _venta_vigente(venta)]
    compras_vigentes = [compra for compra in compras if _compra_vigente(compra)]
    base_gastos = (
        compras if compras_recibidas is None else compras_recibidas
    )

    total_ventas = _importe(
        sum((venta["total"] for venta in ventas_vigentes), _CERO)
    )
    total_compras = _importe(
        sum((compra["total"] for compra in compras_vigentes), _CERO)
    )
    gastos = _importe(
        sum(
            (
                compra["total"]
                for compra in base_gastos
                if _compra_vigente(compra) and compra["estado"] == "recibida"
            ),
            _CERO,
        )
    )
    neto = _importe(total_ventas - gastos)

    venta_neta = _importe(
        sum(
            (
                item["neto"]
                for venta in ventas_vigentes
                for item in venta["items"]
            ),
            _CERO,
        )
    )
    costo_ventas = _importe(
        sum(
            (
                item["cantidad"] * item["costo_unitario"]
                for venta in ventas_vigentes
                for item in venta["items"]
            ),
            _CERO,
        )
    )
    margen_bruto = _importe(venta_neta - costo_ventas)

    return {
        "ventas": total_ventas,
        "compras": total_compras,
        "gastos": gastos,
        "neto": neto,
        "margen_pct": _pct(neto, total_ventas),
        "costo_ventas": costo_ventas,
        "margen_bruto": margen_bruto,
        "margen_bruto_pct": _pct(margen_bruto, venta_neta),
    }


def _inicio_bucket(fecha: date, granularidad: Granularidad) -> date:
    if granularidad == "diario":
        return fecha
    if granularidad == "semanal":
        return fecha - timedelta(days=fecha.weekday())
    if granularidad == "mensual":
        return fecha.replace(day=1)
    if granularidad == "anual":
        return fecha.replace(month=1, day=1)
    raise AnaliticaDatosInvalidos(f"Granularidad desconocida: {granularidad}")


def _siguiente_bucket(inicio: date, granularidad: Granularidad) -> date:
    if granularidad == "diario":
        return inicio + timedelta(days=1)
    if granularidad == "semanal":
        return inicio + timedelta(days=7)
    if granularidad == "mensual":
        if inicio.month == 12:
            return date(inicio.year + 1, 1, 1)
        return date(inicio.year, inicio.month + 1, 1)
    if granularidad == "anual":
        return date(inicio.year + 1, 1, 1)
    raise AnaliticaDatosInvalidos(f"Granularidad desconocida: {granularidad}")


def _buckets(
    desde: date,
    hasta: date,
    granularidad: Granularidad,
) -> list[tuple[date, date]]:
    if desde > hasta:
        raise AnaliticaDatosInvalidos(
            "La fecha desde no puede ser posterior a la fecha hasta"
        )
    actual = _inicio_bucket(desde, granularidad)
    limite = _inicio_bucket(hasta, granularidad)
    buckets: list[tuple[date, date]] = []
    while actual <= limite:
        siguiente = _siguiente_bucket(actual, granularidad)
        buckets.append((actual, siguiente - timedelta(days=1)))
        actual = siguiente
    return buckets


def calcular_tendencias(
    ventas: Sequence[VentaAnalitica],
    compras: Sequence[CompraAnalitica],
    granularidad: Granularidad,
    desde: date,
    hasta: date,
) -> list[PuntoTendencia]:
    """Serie de ventas y gastos agrupada, con los buckets vacíos en cero.

    Los gastos se imputan en la fecha de recepción de la compra.
    """
    ventas_por_bucket: dict[date, Decimal] = {}
    gastos_por_bucket: dict[date, Decimal] = {}

    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fecha = _fecha_venta(venta)
        if not (desde <= fecha <= hasta):
            continue
        bucket = _inicio_bucket(fecha, granularidad)
        ventas_por_bucket[bucket] = (
            ventas_por_bucket.get(bucket, _CERO) + venta["total"]
        )

    for compra in compras:
        if not _compra_vigente(compra) or compra["estado"] != "recibida":
            continue
        fecha = _fecha_gasto(compra)
        if not (desde <= fecha <= hasta):
            continue
        bucket = _inicio_bucket(fecha, granularidad)
        gastos_por_bucket[bucket] = (
            gastos_por_bucket.get(bucket, _CERO) + compra["total"]
        )

    return [
        {
            "inicio": inicio,
            "fin": fin,
            "ventas": _importe(ventas_por_bucket.get(inicio, _CERO)),
            "gastos": _importe(gastos_por_bucket.get(inicio, _CERO)),
        }
        for inicio, fin in _buckets(desde, hasta, granularidad)
    ]


def _aov_upt(ventas_vigentes: Sequence[VentaAnalitica]) -> AovUpt:
    pedidos = len(ventas_vigentes)
    if pedidos == 0:
        return {"aov": Decimal("0.00"), "upt": Decimal("0.000")}

    total = sum((venta["total"] for venta in ventas_vigentes), _CERO)
    unidades = sum(
        (
            item["cantidad"]
            for venta in ventas_vigentes
            for item in venta["items"]
        ),
        _CERO,
    )
    return {
        "aov": _importe(total / Decimal(pedidos)),
        "upt": _cantidad(unidades / Decimal(pedidos)),
    }


def calcular_aov_upt(ventas: Sequence[VentaAnalitica]) -> AovUpt:
    """Ticket promedio (AOV) y unidades por ticket (UPT)."""
    return _aov_upt([venta for venta in ventas if _venta_vigente(venta)])


def calcular_aov_upt_por_periodo(
    ventas: Sequence[VentaAnalitica],
    granularidad: Granularidad,
    desde: date,
    hasta: date,
) -> list[PuntoAovUpt]:
    agrupadas: dict[date, list[VentaAnalitica]] = {}
    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fecha = _fecha_venta(venta)
        if not (desde <= fecha <= hasta):
            continue
        bucket = _inicio_bucket(fecha, granularidad)
        agrupadas.setdefault(bucket, []).append(venta)

    return [
        {
            "inicio": inicio,
            "fin": fin,
            **_aov_upt(agrupadas.get(inicio, [])),
        }
        for inicio, fin in _buckets(desde, hasta, granularidad)
    ]


def calcular_primeras_compras(
    ventas: Sequence[VentaAnalitica],
) -> dict[str, date]:
    """Primera fecha de compra por cliente usando el historial completo."""
    primeras: dict[str, date] = {}
    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fecha = _fecha_venta(venta)
        actual = primeras.get(venta["id_cliente"])
        if actual is None or fecha < actual:
            primeras[venta["id_cliente"]] = fecha
    return primeras


def calcular_nuevos_vs_recurrentes(
    ventas: Sequence[VentaAnalitica],
    primeras_compras: Mapping[str, date],
    granularidad: Granularidad,
    desde: date,
    hasta: date,
) -> list[PuntoNuevosRecurrentes]:
    """Facturación de clientes nuevos vs recurrentes por período.

    Un cliente es nuevo cuando la venta ocurre el mismo día de su primera
    compra; si no hay primera compra conocida, se lo considera nuevo.
    """
    nuevos: dict[date, Decimal] = {}
    recurrentes: dict[date, Decimal] = {}

    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fecha = _fecha_venta(venta)
        if not (desde <= fecha <= hasta):
            continue
        bucket = _inicio_bucket(fecha, granularidad)
        primera = primeras_compras.get(venta["id_cliente"])
        destino = nuevos if primera is None or fecha == primera else recurrentes
        destino[bucket] = destino.get(bucket, _CERO) + venta["total"]

    return [
        {
            "inicio": inicio,
            "fin": fin,
            "nuevos": _importe(nuevos.get(inicio, _CERO)),
            "recurrentes": _importe(recurrentes.get(inicio, _CERO)),
        }
        for inicio, fin in _buckets(desde, hasta, granularidad)
    ]


def calcular_ranking_productos(
    ventas: Sequence[VentaAnalitica],
    limite: int | None = None,
    orden: Orden = "desc",
) -> list[RankingProducto]:
    """Ranking de productos por cantidad vendida, con margen por producto."""
    acumulado: dict[str, _AcumuladoProducto] = {}
    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        for item in venta["items"]:
            fila = acumulado.setdefault(
                item["id_producto"],
                {
                    "nombre": item["nombre"],
                    "cantidad": _CERO,
                    "venta_neta": _CERO,
                    "costo": _CERO,
                },
            )
            fila["cantidad"] += item["cantidad"]
            fila["venta_neta"] += item["neto"]
            fila["costo"] += item["cantidad"] * item["costo_unitario"]

    filas: list[RankingProducto] = []
    for id_producto, datos in acumulado.items():
        venta_neta = _importe(datos["venta_neta"])
        costo = _importe(datos["costo"])
        margen = _importe(venta_neta - costo)
        filas.append(
            {
                "id_producto": id_producto,
                "nombre": datos["nombre"],
                "cantidad": _cantidad(datos["cantidad"]),
                "venta_neta": venta_neta,
                "costo": costo,
                "margen": margen,
                "margen_pct": _pct(margen, venta_neta),
            }
        )

    if orden == "desc":
        filas.sort(key=lambda fila: (-fila["cantidad"], fila["nombre"]))
    else:
        filas.sort(key=lambda fila: (fila["cantidad"], fila["nombre"]))
    return filas[:limite] if limite is not None else filas


def calcular_ranking_clientes(
    ventas: Sequence[VentaAnalitica],
    limite: int | None = None,
) -> list[RankingCliente]:
    """Ranking de clientes por facturación (con IVA) y cantidad de pedidos."""
    acumulado: dict[str, _AcumuladoCliente] = {}
    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fila = acumulado.setdefault(
            venta["id_cliente"],
            {
                "nombre": venta["cliente_nombre"],
                "pedidos": 0,
                "facturacion": _CERO,
            },
        )
        fila["pedidos"] += 1
        fila["facturacion"] += venta["total"]

    filas = [
        {
            "id_cliente": id_cliente,
            "nombre": datos["nombre"],
            "pedidos": datos["pedidos"],
            "facturacion": _importe(datos["facturacion"]),
        }
        for id_cliente, datos in acumulado.items()
    ]
    filas.sort(
        key=lambda fila: (fila["facturacion"], fila["pedidos"]),
        reverse=True,
    )
    return filas[:limite] if limite is not None else filas


def calcular_ranking_proveedores(
    compras: Sequence[CompraAnalitica],
    limite: int | None = None,
) -> list[RankingProveedor]:
    """Ranking por volumen de compra, precio promedio y tiempo de entrega."""
    acumulado: dict[str, _AcumuladoProveedor] = {}
    for compra in compras:
        if not _compra_vigente(compra):
            continue
        fila = acumulado.setdefault(
            compra["id_proveedor"],
            {
                "nombre": compra["proveedor_nombre"],
                "pedidos": 0,
                "volumen": _CERO,
                "unidades": _CERO,
                "dias_entrega": 0,
                "entregas": 0,
            },
        )
        fila["pedidos"] += 1
        fila["volumen"] += compra["total"]
        fila["unidades"] += sum(
            (item["cantidad"] for item in compra["items"]), _CERO
        )
        if (
            compra["fecha_recepcion"] is not None
            and compra["fecha_recepcion"] >= compra["fecha"]
        ):
            fila["dias_entrega"] += (
                compra["fecha_recepcion"] - compra["fecha"]
            ).days
            fila["entregas"] += 1

    filas: list[RankingProveedor] = []
    for id_proveedor, datos in acumulado.items():
        unidades = datos["unidades"]
        volumen = datos["volumen"]
        entregas = datos["entregas"]
        filas.append(
            {
                "id_proveedor": id_proveedor,
                "nombre": datos["nombre"],
                "pedidos": datos["pedidos"],
                "volumen_compra": _importe(volumen),
                "unidades": _cantidad(unidades),
                "precio_promedio": (
                    _importe(volumen / unidades)
                    if unidades > 0
                    else Decimal("0.00")
                ),
                "entrega_promedio_dias": (
                    _importe(Decimal(datos["dias_entrega"]) / Decimal(entregas))
                    if entregas > 0
                    else None
                ),
            }
        )

    filas.sort(key=lambda fila: fila["volumen_compra"], reverse=True)
    return filas[:limite] if limite is not None else filas


def calcular_comparativa_precios(
    compras: Sequence[CompraAnalitica],
) -> list[ComparativaPrecio]:
    """Precio mínimo y promedio ponderado de cada producto por proveedor."""
    acumulado: dict[tuple[str, str], _AcumuladoPrecio] = {}
    nombres: dict[str, str] = {}

    for compra in compras:
        if not _compra_vigente(compra):
            continue
        for item in compra["items"]:
            nombres[item["id_producto"]] = item["nombre"]
            clave = (item["id_producto"], compra["id_proveedor"])
            fila = acumulado.setdefault(
                clave,
                {
                    "proveedor": compra["proveedor_nombre"],
                    "precio_minimo": item["precio_unitario"],
                    "importe": _CERO,
                    "unidades": _CERO,
                    "ultima_compra": compra["fecha"],
                },
            )
            if item["precio_unitario"] < fila["precio_minimo"]:
                fila["precio_minimo"] = item["precio_unitario"]
            fila["importe"] += item["subtotal"]
            fila["unidades"] += item["cantidad"]
            if compra["fecha"] > fila["ultima_compra"]:
                fila["ultima_compra"] = compra["fecha"]

    por_producto: dict[str, list[PrecioProveedor]] = {}
    for (id_producto, id_proveedor), datos in acumulado.items():
        unidades = datos["unidades"]
        importe = datos["importe"]
        por_producto.setdefault(id_producto, []).append(
            {
                "id_proveedor": id_proveedor,
                "proveedor": datos["proveedor"],
                "precio_minimo": _importe(datos["precio_minimo"]),
                "precio_promedio": (
                    _importe(importe / unidades)
                    if unidades > 0
                    else Decimal("0.00")
                ),
                "ultima_compra": datos["ultima_compra"],
            }
        )

    comparativas: list[ComparativaPrecio] = []
    for id_producto, proveedores in por_producto.items():
        proveedores.sort(
            key=lambda fila: (fila["precio_promedio"], fila["proveedor"])
        )
        comparativas.append(
            {
                "id_producto": id_producto,
                "nombre": nombres[id_producto],
                "proveedores": proveedores,
            }
        )
    comparativas.sort(key=lambda fila: fila["nombre"])
    return comparativas


def calcular_inventario_inmovilizado(
    productos: Sequence[ProductoInventario],
    ultima_venta: Mapping[str, date],
    fecha_corte: date,
    dias_minimos: int = 0,
) -> list[InventarioInmovilizado]:
    """Productos con stock y sin ventas recientes; ``None`` = nunca vendido."""
    filas: list[InventarioInmovilizado] = []
    for producto in productos:
        if producto["stock"] <= 0:
            continue
        ultima = ultima_venta.get(producto["id_producto"])
        if ultima is None:
            dias_sin_venta: int | None = None
        else:
            dias_sin_venta = max(0, (fecha_corte - ultima).days)
            if dias_sin_venta < dias_minimos:
                continue
        filas.append(
            {
                "id_producto": producto["id_producto"],
                "nombre": producto["nombre"],
                "stock": _cantidad(producto["stock"]),
                "costo_unitario": _importe(producto["costo_unitario"]),
                "capital": _importe(
                    producto["stock"] * producto["costo_unitario"]
                ),
                "dias_sin_venta": dias_sin_venta,
            }
        )

    filas.sort(
        key=lambda fila: (
            fila["dias_sin_venta"] is not None,
            -(fila["dias_sin_venta"] or 0),
            fila["nombre"],
        )
    )
    return filas


def calcular_margen_por_categoria(
    ventas: Sequence[VentaAnalitica],
) -> list[MargenCategoria]:
    """Margen bruto por categoría usando ventas netas y costo actual."""
    acumulado: dict[str, _AcumuladoCategoria] = {}
    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        for item in venta["items"]:
            fila = acumulado.setdefault(
                item["id_categoria"],
                {
                    "nombre": item["nombre_categoria"],
                    "venta_neta": _CERO,
                    "costo": _CERO,
                },
            )
            fila["venta_neta"] += item["neto"]
            fila["costo"] += item["cantidad"] * item["costo_unitario"]

    filas: list[MargenCategoria] = []
    for id_categoria, datos in acumulado.items():
        venta_neta = _importe(datos["venta_neta"])
        costo = _importe(datos["costo"])
        margen = _importe(venta_neta - costo)
        filas.append(
            {
                "id_categoria": id_categoria,
                "nombre": datos["nombre"],
                "venta_neta": venta_neta,
                "costo": costo,
                "margen": margen,
                "margen_pct": _pct(margen, venta_neta),
            }
        )

    filas.sort(key=lambda fila: fila["venta_neta"], reverse=True)
    return filas


def calcular_mapa_calor(
    ventas: Sequence[VentaAnalitica],
    hora_desde: int = 8,
    hora_hasta: int = 21,
) -> MapaCalor:
    """Facturación por día de semana (0 = lunes) y hora del pedido."""
    if hora_desde < 0 or hora_hasta > 23 or hora_desde > hora_hasta:
        raise AnaliticaDatosInvalidos("Rango horario inválido")

    horas = list(range(hora_desde, hora_hasta + 1))
    valores = [[_CERO for _ in horas] for _ in range(7)]

    for venta in ventas:
        if not _venta_vigente(venta):
            continue
        fecha_hora = venta["fecha_hora"]
        if not (hora_desde <= fecha_hora.hour <= hora_hasta):
            continue
        valores[fecha_hora.weekday()][fecha_hora.hour - hora_desde] += (
            venta["total"]
        )

    return {
        "dias": list(range(7)),
        "horas": horas,
        "valores": [
            [_importe(valor) for valor in fila] for fila in valores
        ],
    }


def calcular_ventas_por_metodo_pago(
    pagos: Sequence[PagoAnalitica],
) -> list[VentaMetodoPago]:
    """Cobros aprobados agrupados por medio de pago, de mayor a menor."""
    acumulado: dict[str, _AcumuladoMedioPago] = {}
    for pago in pagos:
        if pago["estado"] != "aprobado":
            continue
        fila = acumulado.setdefault(
            pago["id_medio_pago"],
            {"medio_pago": pago["medio_pago"], "monto": _CERO},
        )
        fila["monto"] += pago["monto"]

    filas = [
        {
            "id_medio_pago": id_medio_pago,
            "medio_pago": datos["medio_pago"],
            "monto": _importe(datos["monto"]),
        }
        for id_medio_pago, datos in acumulado.items()
    ]
    filas.sort(key=lambda fila: fila["monto"], reverse=True)
    return filas


def predecir_demanda(
    historial: Sequence[Decimal],
    periodos: int = 1,
    ventana: int | None = None,
) -> list[Decimal]:
    """Proyecta demanda con regresión lineal simple sobre el historial.

    ``historial`` debe venir en orden cronológico y con períodos equidistantes.
    La proyección se limita a cero y se redondea a tres decimales. Con
    historial vacío devuelve ceros para no interrumpir el reporte.
    """
    if periodos < 0:
        raise AnaliticaDatosInvalidos(
            "La cantidad de períodos no puede ser negativa"
        )
    if ventana is not None and ventana < 1:
        raise AnaliticaDatosInvalidos("La ventana debe tener al menos un período")
    if periodos == 0:
        return []

    valores = [Decimal(valor) for valor in historial]
    if ventana is not None:
        valores = valores[-ventana:]

    cantidad = len(valores)
    if cantidad == 0:
        return [Decimal("0.000") for _ in range(periodos)]
    if cantidad == 1:
        unico = _cantidad(max(_CERO, valores[0]))
        return [unico for _ in range(periodos)]

    xs = [Decimal(indice) for indice in range(cantidad)]
    suma_x = sum(xs, _CERO)
    suma_y = sum(valores, _CERO)
    suma_xy = sum((x * y for x, y in zip(xs, valores)), _CERO)
    suma_x2 = sum((x * x for x in xs), _CERO)
    denominador = Decimal(cantidad) * suma_x2 - suma_x * suma_x

    if denominador == 0:
        pendiente = _CERO
    else:
        pendiente = (
            Decimal(cantidad) * suma_xy - suma_x * suma_y
        ) / denominador
    intercepto = (suma_y - pendiente * suma_x) / Decimal(cantidad)

    pronosticos: list[Decimal] = []
    for paso in range(periodos):
        x = Decimal(cantidad + paso)
        valor = intercepto + pendiente * x
        pronosticos.append(_cantidad(max(_CERO, valor)))
    return pronosticos


def calcular_variacion(actual: Decimal, anterior: Decimal) -> Decimal | None:
    """Variación porcentual; ``None`` si no hay base de comparación."""
    if anterior == 0:
        return None
    return _porcentaje((actual - anterior) / anterior * _CIEN)
