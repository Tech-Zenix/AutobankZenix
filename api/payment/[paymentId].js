import { sql } from "../_db.js";
import { json, options } from "../_cors.js";

export const runtime = "nodejs";

const TUT_BY_PRODUCT = {
  locketgold15s: "TUT_URL_LOCKETGOLD15S",
  canvapro: "TUT_URL_CANVAPRO",
  gemini5tb: "TUT_URL_GEMINI5TB",
  geminipro5tb: "TUT_URL_GEMINI5TB",
  gemini_pro_5tb: "TUT_URL_GEMINI5TB"
};

function getPaymentId(request) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.indexOf("payment");
  return index >= 0 ? parts[index + 1] : null;
}

function tutUrlFor(product) {
  const envName = TUT_BY_PRODUCT[product];
  return envName ? (process.env[envName] || null) : null;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return options(request);

  if (request.method !== "GET") {
    return json(request, {
      success: false,
      error: "METHOD_NOT_ALLOWED"
    }, 405);
  }

  const paymentId = getPaymentId(request);

  if (!paymentId || !/^[a-f0-9]{32}$/i.test(paymentId)) {
    return json(request, {
      success: false,
      error: "INVALID_PAYMENT_ID"
    }, 400);
  }

  try {
    let rows = await sql`
      SELECT
        payment_id, product, amount, code, status, expires_at,
        sepay_transaction_id, sepay_reference_code, paid_at,
        created_at, updated_at
      FROM payments
      WHERE payment_id = ${paymentId}
      LIMIT 1
    `;

    if (!rows.length) {
      return json(request, {
        success: false,
        error: "PAYMENT_NOT_FOUND"
      }, 404);
    }

    let payment = rows[0];

    if (
      payment.status === "PENDING" &&
      new Date(payment.expires_at).getTime() <= Date.now()
    ) {
      await sql`
        UPDATE payments
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE payment_id = ${paymentId}
          AND status = 'PENDING'
      `;

      rows = await sql`
        SELECT
          payment_id, product, amount, code, status, expires_at,
          sepay_transaction_id, sepay_reference_code, paid_at,
          created_at, updated_at
        FROM payments
        WHERE payment_id = ${paymentId}
        LIMIT 1
      `;

      payment = rows[0];
    }

    const result = {
      success: true,
      payment_id: payment.payment_id,
      product: payment.product,
      amount: Number(payment.amount),
      code: payment.code,
      status: payment.status,
      expires_at: payment.expires_at,
      paid_at: payment.paid_at,
      sepay_transaction_id: payment.sepay_transaction_id,
      sepay_reference_code: payment.sepay_reference_code
    };

    if (payment.status === "PAID") {
      result.tut_url = tutUrlFor(payment.product);
    }

    return json(request, result);
  } catch (error) {
    console.error("payment/status error", error);
    return json(request, {
      success: false,
      error: "PAYMENT_STATUS_FAILED"
    }, 500);
  }
}
