import { sql } from "../_db.js";
import { json, options } from "../_cors.js";

export const runtime = "nodejs";

function extractCode(content) {
  const text = String(content || "").trim();
  const match = text.match(
    /\b(?:locketgold15s|canvapro|gemini5tb)-[A-Z0-9]{6}\b/i
  );
  return match ? match[0] : null;
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function authorized(request) {
  const expected = process.env.SEPAY_API_KEY || "";
  const received = request.headers.get("authorization") || "";
  const prefix = "Apikey ";

  if (!expected || !received.startsWith(prefix)) return false;
  return timingSafeEqual(received.slice(prefix.length), expected);
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return options(request);

  if (request.method !== "POST") {
    return json(request, {
      success: false,
      error: "METHOD_NOT_ALLOWED"
    }, 405);
  }

  if (!authorized(request)) {
    return json(request, {
      success: false,
      error: "UNAUTHORIZED"
    }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(request, {
      success: false,
      error: "INVALID_JSON"
    }, 400);
  }

  try {
    const sepayId = Number(payload?.id);
    const transferAmount = Number(payload?.transferAmount);
    const transferType = String(payload?.transferType || "").toLowerCase();

    if (!Number.isSafeInteger(sepayId) || sepayId <= 0) {
      return json(request, { success: true, ignored: true });
    }

    if (transferType !== "in") {
      return json(request, { success: true, ignored: true });
    }

    if (!Number.isSafeInteger(transferAmount) || transferAmount <= 0) {
      return json(request, { success: true, ignored: true });
    }

    const duplicate = await sql`
      SELECT payment_id
      FROM payments
      WHERE sepay_transaction_id = ${sepayId}
      LIMIT 1
    `;

    if (duplicate.length) {
      return json(request, { success: true, duplicate: true });
    }

    const code =
      String(payload?.code || "").trim() ||
      extractCode(payload?.content);

    if (!code) {
      return json(request, {
        success: true,
        ignored: true,
        reason: "NO_PAYMENT_CODE"
      });
    }

    const payments = await sql`
      SELECT payment_id, amount, status, expires_at
      FROM payments
      WHERE code = ${code}
      LIMIT 1
    `;

    if (!payments.length) {
      return json(request, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_FOUND"
      });
    }

    const payment = payments[0];

    if (payment.status !== "PENDING") {
      return json(request, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_PENDING"
      });
    }

    if (Number(payment.amount) !== transferAmount) {
      return json(request, {
        success: true,
        ignored: true,
        reason: "AMOUNT_MISMATCH"
      });
    }

    if (new Date(payment.expires_at).getTime() <= Date.now()) {
      await sql`
        UPDATE payments
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE payment_id = ${payment.payment_id}
          AND status = 'PENDING'
      `;

      return json(request, {
        success: true,
        ignored: true,
        reason: "PAYMENT_EXPIRED"
      });
    }

    const updated = await sql`
      UPDATE payments
      SET
        status = 'PAID',
        sepay_transaction_id = ${sepayId},
        sepay_reference_code = ${String(payload?.referenceCode || "").trim() || null},
        paid_at = NOW(),
        updated_at = NOW()
      WHERE payment_id = ${payment.payment_id}
        AND status = 'PENDING'
        AND amount = ${transferAmount}
        AND expires_at > NOW()
        AND sepay_transaction_id IS NULL
      RETURNING payment_id, status
    `;

    if (!updated.length) {
      return json(request, {
        success: true,
        ignored: true,
        reason: "PAYMENT_ALREADY_UPDATED"
      });
    }

    console.log("PAYMENT PAID", {
      payment_id: payment.payment_id,
      sepay_id: sepayId,
      reference_code: payload?.referenceCode || null,
      amount: transferAmount,
      code
    });

    return json(request, {
      success: true,
      paid: true,
      payment_id: payment.payment_id
    });
  } catch (error) {
    console.error("sepay webhook error", error);
    return json(request, {
      success: false,
      error: "WEBHOOK_PROCESSING_FAILED"
    }, 500);
  }
}
