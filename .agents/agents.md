# AGENTS.md - Sistema de Gestión Comercial

## 1. Propósito

Este archivo es el **reglamento estricto** que todo agente de IA debe respetar al trabajar en este repositorio. Cualquier desviación de estas reglas está prohibida.

## 2. Arquitectura (OBLIGATORIA)

**Patrón:** Arquitectura en Capas (N-tier) - Monolítico moderno y ágil. **SIN microservicios**.

| Capa | Responsabilidad | Tecnología |
| :-- | :-- | :-- |
| **Presentación (Frontend)** | Interfaz de usuario, renderizado, captura de datos y consumo de APIs. | React, TypeScript, Tailwind CSS, shadcn/ui, React Router v7 |
| **Lógica de Negocio (Backend)** | Reglas de negocio, validaciones comerciales, cálculos (márgenes, predicciones, conciliaciones), orquestación. | Python, FastAPI, JWT, AES-256 |
| **Acceso a Datos** | Persistencia, recuperación y actualización transaccional/relacional. | PostgreSQL |

**Regla crítica:** El **Frontend ÚNICAMENTE renderiza UI y consume APIs**. **Ninguna lógica de negocio** (cálculo de márgenes, predicciones, conciliaciones, etc.) debe ocurrir en el cliente. Todo cálculo es **responsabilidad exclusiva de FastAPI**.

## 3. Stack Tecnológico (Estricto)

| Componente | Tecnología | Notas |
| :-- | :-- | :-- |
| **Frontend** | React + TypeScript + Tailwind CSS + shadcn/ui + React Router v7 | Ver `frontend/package.json` |
| **Testing Frontend** | **Vitest** | **PROHIBIDO Jest**. Ver `frontend/vitest.config.ts` |
| **Backend** | Python + FastAPI | JWT para auth, AES-256 para datos sensibles |
| **Base de Datos** | PostgreSQL | Ver `backend/` | no se usa ORM
| **Infraestructura** | Integración MercadoPago (oficial) para pagos/tarjetas/billeteras | Según SRS |

## 4. Estructura del Repositorio

```
gestion_comercial/
├── .agents/              # Skills, reglas y este archivo
├── backend/              # FastAPI (api/, core/, schemas/, services/, repositories/, utils/)
├── docs/                 # Documentación rectora (ver sección 5)
├── frontend/             # React Router v7 app
│   ├── app/
│   │   ├── components/   # Componentes por dominio (auth, sales, products, etc.)
│   │   ├── config/       # Configuración app
│   │   ├── lib/          # Utilidades compartidas
│   │   └── routes/       # Rutas React Router
│   └── package.json
├── arquitectura_GC.docx
├── SRS-Gestion-Comercial.docx
└── Roadmap_GC.docx
```

## 5. Documentación de Referencia (OBLIGATORIA)

**ANTES** de crear nuevas pantallas, flujos o componentes, **DEBES** consultar:

| Documento | Cuándo usarlo |
| :-- | :-- |
| **`docs/SRS-Gestion-Comercial.docx`** | Reglas de roles, campos obligatorios (ej. DNI/CUIT en clientes), integraciones (MercadoPago), requisitos funcionales/no funcionales |
| **`docs/arquitectura_GC.docx`** | Dudas sobre división de capas, responsabilidades, arquitectura N-tier |
| **`docs/Roadmap_GC.docx`** | Validar dependencias entre etapas, priorización de funcionalidades |

> Si los documentos `.docx` están en la raíz, también puedes referirte a ellos directamente. Siempre prioriza estos documentos sobre suposiciones.

## 6. Reglas de Desarrollo

### 6.1 Separación de Responsabilidades
- **Frontend:** Solo renderiza UI y consume APIs. Sin lógica de negocio.
- **Backend:** Única fuente de verdad para cálculos, validaciones comerciales, reglas de negocio.
- **API-first:** Toda operación con reglas debe pasar por endpoints de FastAPI.

### 6.2 Testing (Frontend)
- **Framework:** **Vitest exclusivamente** (`npm test`, `npm run test:coverage`)
- **Ubicación obligatoria:** Las pruebas unitarias deben estar **exactamente en la misma carpeta** que el componente que testean.
  - Ejemplo: `Button.tsx` → `Button.test.tsx` (mismo directorio)
- **No mover tests** a carpetas `__tests__/` o `tests/` separadas.

### 6.3 UI/UX
- **Alta densidad:** Diseños optimizados para paneles analíticos (Dashboard). Maximizar información útil sin ruido.
- **Layouts divididos:** Usar layouts de pantalla dividida cuando sea apropiado.
- **Sin márgenes excesivos:** Aprovechar el espacio eficientemente.
- **Componentes base:** Usar **shadcn/ui** (`frontend/app/components/ui/`).

### 6.4 Roles del Sistema
Según SRS, el sistema maneja **3 roles**: **Ventas**, **Abastecimiento**, **Administrador**. Respetar permisos por rol en UI y validar en backend.

## 7. Comandos del Proyecto

### Frontend (`frontend/`)
```bash
npm run dev          # Servidor de desarrollo (React Router)
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run typecheck    # react-router typegen && tsc
npm test             # vitest --run
npm run test:watch   # vitest (watch mode)
npm run test:coverage # vitest --run --coverage
```

### Backend (`backend/`)
```bash
# Revisar estructura y scripts según configuración del proyecto
# Usar entorno virtual en backend/.venv si existe
```

## 8. Reglas para el Agente

1. **Consultar primero:** Antes de crear pantallas/flujos, leer SRS, arquitectura y roadmap.
2. **Respetar capas:** Nunca mover lógica de negocio al frontend.
3. **Tests co-localizados:** Siempre crear `.test.tsx` junto al componente con Vitest.
4. **Sin Jest:** Nunca agregar Jest ni dependencias relacionadas.
5. **Stack estricto:** No cambiar tecnologías sin justificación basada en documentos rectores.
6. **Roles y campos:** Respetar roles, campos obligatorios (DNI/CUIT) e integraciones definidas en SRS.
7. **Alta densidad UI:** Seguir directrices de UI/UX para paneles analíticos.
8. **Verificar:** Ejecutar `npm run typecheck` y `npm test` tras cambios en frontend.

## 9. Modelo de datos

1. Entidades de Configuración y CatálogosCondicionIVA   Atributos: CodigoARCA (char), Descripcion (string).PK: IDcondicionIVA (string).Relaciones: 1 a * con Cliente.AlicuotaIVA   Atributos: CodigoARCA (char), descripcion (string), Porcentaje (float), tipoIVA (char).PK: IDalicuotaIVA (string).Relaciones: 1 a * con Producto.Categoria   Atributos: Nombre (char).PK: IDCategoria (string).Relaciones: 1 a * con Producto.Unidad   Atributos: descripcion (string), UnidadVenta (char).PK: IDunidad (string).Relaciones: 1 a * con Producto.MedioPago   Atributos: medioPago (char), TipoCobro (char).PK: IDmedioPago (string).Relaciones: 1 a * con Pago.2. Entidades Principales (Sujetos)Cliente   Atributos: Apellido (char), DNI/CUIT (char), eMail (char), Nombre (char), Saldo (float), Telefono (string).PK: IDcliente (string).FK: IDcondicionIVA (string).Relaciones: 1 a * con Direccion, 1 a * con PedidoCliente, 1 a 0..* con PresupuestoCliente.Proveedor   Atributos: Banco (string), Cuenta (char), CUIT (char), eMail (char), RazonSocial (char), Saldo (float), Telefono (string).PK: IDproveedor (string).Relaciones: 1 a * con Direccion, 1 a * con PedidoProveedor.Direccion (Maneja múltiples direcciones por sujeto)   Atributos: Altura (char), calle (char), CP (char), Depto (char), Localidad (char), Provincia (char).PK: IDdireccion (string).FK: IDcliente (string) [Opcional/Nullable], IDproveedor (string) [Opcional/Nullable].Empleado   Atributos: Apellido (char), ContrasenaHash (string), DNI/CUIL (string), eMail (string), FechaAlta (datetime), FechaIngreso (date), FechaModificacion (datetime), Nombre (char), Puesto (char), Rol (char), Telefono (string).PK: IDempleado (string).Relaciones: 1 a * con PedidoProveedor, 1 a * con LogAuditoria.Producto   Atributos: Descripcion (string), Estado (bool), Margen (float), Nombre (char), PrecioCompra (float), precioVenta (float), StockActual (decimal), StockMinimo (decimal).PK: IDproducto (string).FK: IDalicuotaIVA (string), IDCategoria (string), IDunidad (string).Relaciones: 1 a * con DetPresupuestoCliente, 1 a * con DetallePedidoCliente, 1 a * con DetallePedidoProveedor, 1 a * con MovimientoInventario.3. Entidades Transaccionales (Ventas y Cobros)PresupuestoCliente   Atributos: DescuentoCompra (float), Estado (char), FechaCreacion (datetime), FechaMuestra (date), FechaVence (date), Total (float).PK: IDpresupuestoCliente (string).FK: IDcliente (string).Relaciones: 1 a * con DetPresupuestoCliente, 0..1 a 1 con PedidoCliente.DetPresupuestoCliente   Atributos: cantidad (decimal), DescuentoProducto (float), IVA (float), Neto (float), PrecioUnitario (float), subtotal (float), TipoIVA (char).PK (Compuesta): IDpresupuestoCliente (string), IDproducto (string).PedidoCliente   Atributos: DescuentoCompra (float), EntregaAltura (string), EntregaCalle (string), EntregaCP (char), EntregaDepto (string), EntregaLocalidad (string), EstadoEnvio (char), FechaEmision (datetime), FechaMuestra (date), SaldoPendiente (float), Total (float).PK: IDpedidoCliente (string).FK: IDcliente (string), IDpresupuestoCliente (string).Relaciones: 1 a * con DetallePedidoCliente, 1 a 1 con ComprobanteVenta, 1 a * con MovimientoInventario.DetallePedidoCliente   Atributos: cantidad (decimal), DescuentoProducto (float), IVA (float), Neto (float), PrecioUnitario (float), Subtotal (float), TipoIVA (char).PK (Compuesta): IDpedidoCliente (string), IDproducto (string).ComprobanteVenta   Atributos: EstadoPago (char), FechaEmision (date), FechaPago (date), Monto (float), TipoComprobante (char).PK: IDcomprobanteVenta (string).FK: IDpedidoCliente (string).Relaciones: 1 a * con Pago.Pago   Atributos: estado (char), fechaPago (date), monto (float), referencia (char).PK: IDpago (string).FK: IDcomprobanteVenta (string), IDmedioPago (string).4. Entidades Transaccionales (Compras e Inventario)PedidoProveedor   Atributos: Estado (char), FechaPedido (date), FechaRecepcion (date), Total (float).PK: IDpedidoProveedor (string).FK: IDempleado (string), IDmedioPago (string), IDproveedor (string).Relaciones: 1 a * con DetallePedidoProveedor, 1 a * con MovimientoInventario.DetallePedidoProveedor   Atributos: cantidad (decimal), PrecioUnitario (float), Subtotal (float).PK (Compuesta): IDpedidoProveedor (string), IDproducto (string).MovimientoInventario (Tabla de Kardex/Auditoría de Stock)   Atributos: Cantidad (decimal), FechaMovimiento (date), Motivo (string), Tipo (char).PK: IDmovimiento (string).FK: IDpedidoCliente (string) [Opcional], IDpedidoProveedor (string) [Opcional], IDproducto (string).5. Entidad de Auditoría GeneralLogAuditoria   Atributos: Accion (char), DatoAnterior (string), DatoNuevo (string), EntidadAfectada (char), FechaHora (datetime), IDentidad (string).PK: IDlog (string).FK: IDempleado (string).