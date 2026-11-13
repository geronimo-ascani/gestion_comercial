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
  `003_producto_reservas.sql`, `004_pedido_provincia_entrega.sql`.
- Start the backend from `backend/` with `fastapi dev app/main.py`.
- Start the frontend from `frontend/` with `npm run dev`.
- Backend tests: `python -m pytest -q` from `backend/`.
- Frontend tests: `npm test`; typecheck: `npm run typecheck`; production build:
  `npm run build`, from `frontend/`.
- Do not commit `.env`, credentials, or database test data.

## Roles and Existing Business Rules

- Roles are `administrador`, `ventas`, and `abastecimiento`.
- Sales can create customers inline; supply can create suppliers inline.
  Editing/deleting customers and suppliers remains administrator-only.
- Customer DNI/CUIT and supplier CUIT are normalized for duplicate checks.
  Deleting a referenced customer or supplier returns `409 Conflict`.
- Product deactivation is a soft delete. Operational stock changes must be
  atomic and recorded in `movimiento_inventario`; stock cannot go negative.
- Reserved product codes can be annulled only before use and are not reused.
- The current sales price is calculated from product purchase price, margin,
  and VAT rate. For sales orders, always use the current catalog price; never
  trust a client-supplied unit price.

## Stage 2 Transaction Rules

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
- Payment methods, invoices, and payment records belong to the later payment
  stage. Do not require or persist a sales-order payment method in Stage 2.
- Budget conversion is deferred to RF-11; do not make a local budget into a
  server order as part of this stage.

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

## Current Stage 2 Status

- Customer/supplier CRUD and purchase-order backend/frontend flow are already
  implemented.
- Transactional sales-order backend and frontend integration are implemented.
- Sales API: `GET /ventas/pedidos`, `GET /ventas/pedidos/{id}`,
  `POST /ventas/pedidos`, `PUT /ventas/pedidos/{id}`,
  `PATCH /ventas/pedidos/{id}/estado`, and
  `POST /ventas/pedidos/{id}/cancelacion`.
- Sales order endpoints are restricted to `administrador` and `ventas`.
  List/detail, pending-only edits, sequential state transitions, and
  idempotent cancellation are enforced by the backend.
- Focused service and route tests cover sales discounts, VAT, stock reservation
  and restoration, allowed transitions, and role permissions. The PostgreSQL
  create/edit/state/cancel probe was run with temporary data and rolled back.
- `README.md` and `backend/README.md` are intentionally empty; this file is the
  maintained project context.
