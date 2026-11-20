# Project Context

## Architecture

- This repository is a commercial-management web app.
- `backend/` is a FastAPI application using PostgreSQL through psycopg.
  Keep the existing router → service → repository layering.
- `frontend/` is a React Router and TypeScript application.
- The API is mounted at `/api/v1`. Authenticated requests use JWT bearer tokens.
- Use additive SQL migrations in `backend/sql/`; never rewrite an applied
  migration. Keep credentials in `backend/.env`, which must not be committed.

## Setup and Verification

- Apply database migrations in order:
  `001_schema_completo.sql`, `002_auth_recovery.sql`,
  `003_producto_reservas.sql`, `004_pedido_provincia_entrega.sql`,
  `005_comprobantes_pagos.sql`, `006_multiempresa.sql`,
  `007_comprobante_envio_copias.sql`, `008_comprobante_snapshot.sql`.
- Start the backend from `backend/` with `fastapi dev app/main.py`.
- Start the frontend from `frontend/` with `npm run dev`.
- Backend tests: `python -m pytest -q` from `backend/`.
- Frontend tests: `npm test`; typecheck: `npm run typecheck`; production build:
  `npm run build`, from `frontend/`.
- Do not commit `.env`, credentials, or database test data.

## Multi-tenant Isolation

- Every business record belongs to one company through `id_empresa`:
  products and stock, categories, customers, suppliers, sales orders, sales
  budgets, purchase orders, comprobantes, payments, and payment methods.
- The company is always derived from the authenticated employee. Never accept
  an `id_empresa` from the request body for scoping or emission. Repositories
  receive `id_empresa` per request through dependency injection; services and
  routes pass it explicitly where needed (`AuthService` and `AuthRepository`
  are unscoped because login is global).
- Registration at `POST /auth/register` is public and self-service: it creates a
  new company with empty fiscal data plus its administrator user. There is no
  superadmin. Each administrator manages only their own company and employees.
- The first registered user is assigned to `EMP-0001`; later registrations
  create a new company. Data that existed before migration
  `006_multiempresa.sql` belongs to `EMP-0001`.
- Employees always belong to the company of the administrator who creates them;
  there is no company selector when creating an employee. Employee email is
  global because it is the login. Customer DNI/CUIT and supplier CUIT are unique
  within a company, not globally.
- Company fiscal data lives in `empresa`: razón social, nombre de fantasía,
  CUIT, IVA condition, domicilio, punto de venta, email, teléfono, ingresos
  brutos, inicio de actividades, código postal, localidad, provincia, and
  `activa`. The CUIT is required to have 11 digits when saving through the API;
  placeholder companies may keep it empty until the administrator completes it.
- Company endpoints: `GET /empresas` is administrator-only and returns the
  caller's company, `GET /empresas/actual` is available to every role, and
  `PUT /empresas/{id}` is administrator-only and restricted to the caller's own
  company. There is no `POST /empresas`: companies are created only by
  registration.
- The frontend "Mi empresa" screen (`/company`) is visible to all roles and
  editable only by administrators. It warns when fiscal data is incomplete.
- Emitting a comprobante returns `409 Conflict` when the company is inactive or
  its CUIT does not have 11 digits. The comprobante issuer is always the
  authenticated employee's company.
- VAT conditions, VAT rates, and units are global catalogs. Categories and
  payment methods are per company and are seeded for each new company.
- Migration `006_multiempresa.sql` adds the company fiscal columns, per-company
  `id_empresa` columns and unique indexes, and the catalog seeding trigger.

## Roles and Existing Business Rules

- Roles are `administrador`, `ventas`, and `abastecimiento`.
- Sales can create and manage customers, including inline creation. Supply can
  create and manage suppliers, including inline creation. Administrators can
  manage both.
- Customer DNI/CUIT, supplier CUIT, and employee DNI/CUIL are normalized to
  digits for duplicate checks. Customer and supplier uniqueness is per company.
  Deleting a referenced customer or supplier returns `409 Conflict`.
- Employee management is administrator-only and scoped to the administrator's
  company. Employee deletion is physical; PostgreSQL references from purchase
  orders and audit logs restrict deletion and the API returns `409 Conflict`. Do
  not add a self-deletion or last-administrator policy until that business rule
  is defined.
- Product deactivation is a soft delete. Operational stock changes must be
  atomic and recorded in `movimiento_inventario`; stock cannot go negative.
- Reserved product codes can be annulled only before use and are not reused.
- The current sales price is calculated from product purchase price, margin,
  and VAT rate. For sales orders, always use the current catalog price; never
  trust a client-supplied unit price.

## Transaction Rules

### Sales orders

- Sales orders are created in `pendiente` and reserve stock immediately.
- Only pending orders can be edited. Update stock by applying line-level
  quantity deltas in the same transaction as the order changes.
- Keep both existing discount levels: per-line discount first, then the
  order-wide discount. Validate percentages and calculate all totals server
  side. Product catalog prices include the product's configured VAT rate.
- The delivery address is stored on the order and includes province. The
  additive migration `004_pedido_provincia_entrega.sql` adds that field.
- Allowed fulfillment transitions are sequential:
  `pendiente → proceso → enviado → entregado`. A repeated current state is
  idempotent; arbitrary backward transitions are not allowed.
- Cancellation is allowed before delivery. Restore reserved stock once, mark
  the order `cancelado`, and do not permit reopening a canceled order.
- Payment methods, invoices, and payment records belong to the payment stage.
  Do not require or persist a payment method on the sales order itself;
  payments attach to the emitted comprobante.

### Comprobantes and payments

- A comprobante can be issued as soon as the order is created (`pendiente`)
  and while it is not canceled. Emitting is idempotent: repeating the request
  returns the existing comprobante with `200`, and one order can have only one
  comprobante.
- The issuer is configured per company in the `empresa` table (razón social,
  CUIT, IVA condition, domicilio, punto de venta, email, teléfono, `activa`,
  plus the fiscal fields added by migration `006_multiempresa.sql`). Company
  data never comes from environment variables. Administrators manage their own
  company through `/empresas`; every role can read it through
  `/empresas/actual`.
- Comprobante type: a monotributista or exento issuer produces type C; a
  responsable inscripto issuer produces type A for responsable inscripto or
  monotributista customers and type B otherwise. Type E is reserved for the
  future fiscal/export stage.
- Numbering is consecutive per `(id_empresa, punto_venta, tipo_comprobante)`
  through `comprobante_secuencia`; numbers are never reused.
- Comprobantes are internal for now. Fiscal fields for ARCA are prepared but
  not transmitted.
- An emitted comprobante is immutable. The header stores the total, and the
  issuer's fiscal data, customer data, delivery address and line items are
  snapshotted in `comprobante_venta` and `comprobante_item` at emission. Payment
  state and balances remain derived from approved payments. The order's
  fulfillment state is snapshotted for the API but is not shown in the customer
  PDF. `cliente_email` is returned by both summary and detail endpoints from
  that snapshot.
- `estado_pago` derives from approved payments: `emitida` without payments,
  `aprobada` with a partial payment, `pagada` at zero balance. Pending or
  rejected payments are stored but do not affect the balance; the committed
  amount cannot exceed the comprobante total. Partial payments are allowed.
- Approved payments update the comprobante balance and
  `pedido_cliente.saldo_pendiente` atomically.
- The backend generates the PDF with `fpdf2`. Sending by email attaches that
  PDF and records every attempt in `comprobante_envio` as `enviado` or
  `fallido`; a delivery failure is recorded before the API returns `502`.
- `POST /ventas/comprobantes/{id}/envio` accepts `destinatario`, `cc` and `bcc`.
  `destinatario` is optional and defaults to the customer's email; each copy
  list allows at most 5 addresses. Addresses are normalized and duplicated
  addresses are removed, including any copy equal to the main recipient. The
  email sets `To`, `Cc` and `Bcc`. Every attempt, successful or failed, stores
  the recipient and the copy lists in `comprobante_envio`, which is also
  returned by `GET /ventas/comprobantes/{id}/envios`. Invalid emails or more
  than 5 copies return `422`. The UI opens a reusable dialog on both Payments
  and the sales-order detail to edit these addresses before sending.
- Payment methods are per-company catalog rows. Only administrators create them
  through `POST /medios-pago`; administrators and sales register payments and
  send comprobantes.
- Migration `005_comprobantes_pagos.sql` adds `empresa`,
  `comprobante_secuencia`, `comprobante_envio`, the new comprobante columns,
  and `pago.creado_en`. Migration `007_comprobante_envio_copias.sql` adds the
  `cc` and `bcc` columns to `comprobante_envio` (empty arrays for existing
  rows). Migration `008_comprobante_snapshot.sql` adds the immutable snapshot
  columns and `comprobante_item`, and backfills existing comprobantes from the
  current catalog data as a best effort.

### Sales budgets

- Budgets are available to `administrador` and `ventas`; creation starts in
  `pendiente`. Only pending budgets can be edited or deleted.
- Approval is explicit. A budget whose expiry date has passed is `vencido`
  and cannot be approved or converted; issue a new budget instead.
- Budget prices, VAT, line discounts, and order discount are calculated on the
  server and saved as quote snapshots. Creating or editing a budget does not
  reserve stock and is allowed even when available stock is insufficient; the
  UI warns about the affected products. Approval requires sufficient available
  stock for every line and returns `409 Conflict` otherwise, leaving the
  budget pending.
- Conversion is allowed only for approved, unexpired budgets. The delivery
  address is collected during conversion. In one transaction, preserve the
  quoted totals, link one sales order to the budget, reserve stock, write
  sales inventory movements, and mark the budget `convertido`. A budget can
  be converted only once.

### Purchase orders

- Administrators and supply employees can create and manage purchase orders.
- The authenticated employee is the order employee; do not trust an employee
  ID from the request body.
- A payment method is required at creation. Supply enters each unit purchase
  price; the backend calculates line subtotals and order total.
- Orders are created as `pendiente`. Receipt is complete (not partial) and
  idempotent; stock increments and purchase movements are written in one
  database transaction.
- Cancellation is allowed before receipt and has no stock effect.
- Purchase approval is not part of the current workflow: requests cannot set
  the order state, and no approval endpoint/action exists. Keep `aprobada`
  only for compatibility with any legacy database rows; new orders always
  start as `pendiente`.
- The purchase form preserves its draft and selected payment method while
  navigating to inline supplier creation.

## API and Data Conventions

- Use Pydantic request/response schemas and explicit service exceptions mapped
  to appropriate HTTP status codes.
- Derive identity and roles from the authenticated user. Enforce permissions
  in backend routes even when the frontend also hides controls.
- Use `Decimal` for monetary and quantity calculations. Round money to two
  decimal places and quantities to three, matching the database schema.
- All order mutations affecting inventory, detail rows, or order state must be
  in a single transaction and safe against concurrent updates.
- Add focused tests for service rules, route permissions/status codes, rollback,
  idempotency, and inventory effects.

## Analytics Calculation Rules

- Pure calculations live in `backend/app/services/analitica_calculos.py`; they
  take plain typed structures and return `Decimal` values, so they can be
  reused by repositories, routes, and tests without database access.
- Money is rounded to two decimals, quantities to three, and percentages to two
  with `ROUND_HALF_UP`.
- Sales KPIs use order totals including VAT. Purchases exclude canceled orders;
  expenses (`gastos`) include only received purchases and are imputed on the
  reception date for trends.
- Gross margin uses net sales (without VAT) minus the product's current
  `precio_compra` as unit cost. It is not the same as `neto`, which subtracts
  received purchases from sales totals. Costs, gross margin and category
  margins are available to `ventas`; the net margin (`margen_pct`), purchase
  totals, expenses (`gastos`) and `neto` remain administrator-only because they
  depend on purchase data.
- A customer counts as new when an order falls on the same date as their first
  non-canceled purchase; otherwise the order is recurrent.
- Demand forecasting is a simple linear regression over chronological,
  equidistant periods, clamped at zero.
- Analytics remain backend-owned: the frontend must not recompute these values
  or trust client-supplied figures.

## Current Status

- Customer/supplier CRUD and purchase-order backend/frontend flow are already
  implemented.
- Transactional sales-order backend and frontend integration are implemented.
- Sales API: `GET /ventas/pedidos`, `GET /ventas/pedidos/{id}`,
  `POST /ventas/pedidos`, `PUT /ventas/pedidos/{id}`,
  `PATCH /ventas/pedidos/{id}/estado`, and
  `POST /ventas/pedidos/{id}/cancelacion`.
- Budget API: CRUD under `/ventas/presupuestos`, plus
  `POST /ventas/presupuestos/{id}/aprobacion` and
  `POST /ventas/presupuestos/{id}/conversion`.
- Employee management API: `GET/POST /auth/employees`,
  `GET/PATCH/DELETE /auth/employees/{id}`, and
  `PUT /auth/employees/{id}/password` for administrator-managed password
  changes. Password changes invalidate existing sessions and pending password
  recovery links. The public bootstrap registration at `POST /auth/register`
  remains separate.
- Sales order endpoints are restricted to `administrador` and `ventas`.
  List/detail, pending-only edits, sequential state transitions, and
  idempotent cancellation are enforced by the backend.
- Focused service and route tests cover sales discounts, VAT, stock reservation
  and restoration, allowed transitions, and role permissions. The PostgreSQL
  create/edit/state/cancel probe was run with temporary data and rolled back.
- Budget CRUD, approval, expiry, price snapshots, one-time conversion,
  delivery address capture, stock reservation, and inventory movements are
  implemented in the backend and integrated with the sales frontend.
- Employee listing, creation, detail, editing, and physical deletion are
  integrated with the employee frontend, scoped to the administrator's company;
  referenced accounts cannot be deleted.
- Frontend navigation, route guards, and analytics sections are filtered by role
  through `frontend/app/lib/permissions.ts`. The backend still enforces every
  permission; the frontend only hides inaccessible views and actions.
- The analytics calculation core is implemented and unit-tested in
  `backend/app/services/analitica_calculos.py` (KPIs, trends, AOV/UPT, new vs.
  recurring, heatmap, rankings, price comparison, category margin, idle
  inventory, payment methods, demand forecast, and percentage variation).
- Analytics are served by `GET /analiticas?periodo=...` (roles
  `administrador`, `ventas`, `abastecimiento`), backed by
  `analitica_repository.py`, `analitica_service.py`, and the response schema in
  `schemas/analitica.py`. Sections are returned according to the role:
  administrators receive everything, sales receive commercial sections
  including costs, gross margin and category margins (but not purchase totals,
  expenses, net margin or net income), and supply receives supplier/price/
  inventory sections plus the demand forecast.
- The analytics frontend now consumes the real endpoint through
  `frontend/app/components/analytics/analytics-api.ts`; the executive report
  prints the same backend data. The main dashboard (`/dashboard`, administrator
  only) is backed by `/analiticas` for KPIs and trends,
  `/productos/alertas-stock` for critical stock, and `/ventas/pedidos` for
  recent orders. The frontend only renders those backend results; it does not
  recompute analytics.
- Comprobante API: `POST/GET /ventas/pedidos/{id}/comprobante` (emit and read
  by order), `GET /ventas/comprobantes`, `GET /ventas/comprobantes/{id}`,
  `GET/POST /ventas/comprobantes/{id}/pagos`,
  `POST /ventas/comprobantes/{id}/envio`, and
  `GET /ventas/comprobantes/{id}/envios`. Global payment listing is
  `GET /ventas/pagos`. Payment methods use `GET/POST /medios-pago`, and
  company configuration uses `GET /empresas` (administrator),
  `GET /empresas/actual` (all roles), and `PUT /empresas/{id}` (administrator,
  own company only).
- Comprobante and payment endpoints are restricted to `administrador` and
  `ventas`; creating payment methods and managing companies is restricted to
  `administrador`. Focused service and route tests cover emission idempotency,
  type selection, numbering, payments, balances, sending, and role permissions.
  The PostgreSQL emission/payment probe was run with temporary data and rolled
  back. Comprobante responses now include `cliente_email` in both summaries and
  details, so those endpoints return `200` instead of a response-validation
  `500`. Emission snapshots the issuer, customer, delivery address and items;
  tests verify later changes to the order, company and catalog do not alter an
  emitted comprobante. Migration `008` backfills existing rows and was applied
  locally.
- The payments frontend uses the real API through
  `frontend/app/components/payments/payments-api.ts`. Comprobantes are emitted,
  collected, and sent from the order detail page and the payments page; the
  backend PDF replaces the former client-side PDF, and the simulated gateway
  and reconciliation flows were removed.
- SMTP delivery is centralized in `backend/app/services/email_service.py` and
  shared by comprobante sending and password recovery. Sending requires SMTP
  configuration; without it the API returns `409`, and a failed delivery
  returns `502`.
- Multi-tenant isolation is implemented across products and stock, categories,
  customers, suppliers, sales orders, budgets, purchase orders, comprobantes,
  payments, and payment methods. Migration `006_multiempresa.sql` adds the
  company fiscal columns, per-company `id_empresa` columns and uniqueness, and
  the catalog seeding trigger. Existing data is assigned to `EMP-0001`.
- Public self-service registration creates a new company with empty fiscal data
  plus its administrator. `GET /empresas/actual` and `PUT /empresas/{id}` are
  scoped to the authenticated employee's company, and the "Mi empresa" frontend
  screen (`/company`) is available to all roles, editable by administrators.
- Comprobante emission uses the authenticated employee's company as issuer and
  is blocked with `409 Conflict` when the company is inactive or lacks a
  11-digit CUIT.
- `README.md` and `backend/README.md` are intentionally empty; this file is the
  maintained project context.
