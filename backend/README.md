# Backend

## Setup

Copy `.env.example` to `.env`, set `DATABASE_URL`, and generate a unique
`JWT_SECRET_KEY` of at least 32 characters. Do not commit `.env`.

Apply the initial schema and the password-recovery migration to the target
PostgreSQL database:

```powershell
psql "$env:DATABASE_URL" -f .\sql\001_schema_completo.sql
psql "$env:DATABASE_URL" -f .\sql\002_auth_recovery.sql
psql "$env:DATABASE_URL" -f .\sql\003_producto_reservas.sql
psql "$env:DATABASE_URL" -f .\sql\004_pedido_provincia_entrega.sql
```

Run the API from this directory with `fastapi dev app/main.py`.

The first successful `POST /api/v1/auth/register` creates the administrator.
After that, registration is available only to an authenticated administrator.
No administrator is provisioned from environment variables.

The auxiliary migration creates the one-time password-reset token and shared
authentication rate-limit tables. Password reset requires `SMTP_HOST` and
`SMTP_SENDER`; configure SMTP credentials and `FRONTEND_BASE_URL` to deliver
reset links to the frontend.

## Inventory access

- All authenticated employee roles can view products and reference catalogs.
- Administrators manage products and categories.
- Administrators and supply employees can view stock alerts/history and record
  stock adjustments.
- Product edits cannot change current stock; every balance change is recorded
  as an inventory movement.
- Deactivated products are excluded from normal reads and cannot be edited or
  receive stock adjustments until reactivated by an administrator.
- Reserved product codes can be annulled with
  `DELETE /api/v1/productos/codigos/{id_producto}` while they remain unused.
  Annulled codes are not reused; the reservation migration records their
  status and prevents later product creation with that code.

## Customers and suppliers

- `GET /api/v1/clientes` and `GET /api/v1/clientes/{id}` are available to
  administrators and sales employees. Administrators and sales employees can
  create customers; update and delete operations are administrator-only.
- `GET /api/v1/proveedores` and `GET /api/v1/proveedores/{id}` are available to
  administrators and supply employees. Administrators and supply employees can
  create suppliers; update and delete operations are administrator-only.
- Both lists accept `q`, `limit`, and `offset`. Customer addresses are managed
  with the customer record; supplier addresses are managed with the supplier
  record. `GET /api/v1/condiciones-iva` supplies the required customer tax
  condition options.
- DNI/CUIT values are stored as digits only, so punctuation differences do not
  bypass duplicate checks. Create and update requests require a complete
  address; older records without an address are returned with empty address
  fields.
- DNI/CUIT and supplier CUIT duplicates return `409 Conflict`. Deleting an
  entity referenced by an order or budget returns `409 Conflict`; historical
  records are not deleted. Account balances are read-only in these endpoints.
- These endpoints use the existing `cliente`, `proveedor`, and `direccion`
  tables from `001_schema_completo.sql`; no additional migration is needed.
- Purchase orders capture a database-backed payment method at creation.
- Delivery province for sales orders is added by
  `004_pedido_provincia_entrega.sql`.

## Purchase orders

- `POST /api/v1/compras/pedidos` creates an order with one or more active
  products, entered unit purchase prices, and a required payment method. The
  authenticated employee is recorded by the backend, and the total is
  calculated from the detail lines.
- `GET /api/v1/compras/pedidos` and
  `GET /api/v1/compras/pedidos/{id_pedido_proveedor}` return order headers and
  their product details. Lists accept `estado`, `q`, `limit`, and `offset`.
- `POST /api/v1/compras/pedidos/{id_pedido_proveedor}/recepcion` receives the
  full order. It updates product stock and writes purchase inventory movements
  in the same transaction. Repeating receipt does not apply the stock twice.
- `POST /api/v1/compras/pedidos/{id_pedido_proveedor}/cancelacion` cancels a
  pending or approved order without changing stock. Received orders cannot be
  cancelled.
- These endpoints are available to administrators and supply employees.
- The purchase-order form, list, full-receipt action, and cancellation action
  use these endpoints; the backend remains authoritative for order totals and
  inventory changes.
