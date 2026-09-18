# autobank-zenix

Vercel Functions + Neon Postgres backend for ZENIX LAB automatic bank-payment verification.

Required Vercel environment variables:

- `DATABASE_URL` — Neon connection string.
- `SEPAY_API_KEY` — API key configured in the SePay webhook.
- `ALLOWED_ORIGINS` — comma-separated exact browser origins. Leave empty during initial testing; restrict it for production.
- Optional `TUT_URL_LOCKETGOLD15S`
- Optional `TUT_URL_CANVAPRO`
- Optional `TUT_URL_GEMINI5TB`

Routes:

- `GET /api/health`
- `POST /api/payment/create`
- `GET /api/payment/{payment_id}`
- `POST /api/webhook/sepay`

The create endpoint accepts a product key, never a client-supplied amount. The server sets the amount and creates a 15-minute expiry.

SePay should call:

`https://YOUR-VERCEL-DOMAIN/api/webhook/sepay`

with API Key authentication.

Run `sql/001_indexes.sql` once in Neon SQL Editor before testing.
