# Backend

## Setup

Copy `.env.example` to `.env`, set `DATABASE_URL`, and generate a unique
`JWT_SECRET_KEY` of at least 32 characters. Do not commit `.env`.

Apply the initial schema and the password-recovery migration to the target
PostgreSQL database:

```powershell
psql "$env:DATABASE_URL" -f .\sql\001_schema_completo.sql
psql "$env:DATABASE_URL" -f .\sql\002_auth_recovery.sql
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
