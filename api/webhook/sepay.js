import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const sql = neon(process.env.DATABASE_URL);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "*";

function setCors(res, req) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const origins = ALLOWED_ORIGINS
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function generateResponse(res, req, body, status = 200) {
  setCors(res, req);

  res.status(status).json(body);
}

function extractCode(content) {
  const text = String(content || "").trim();

  const match = text.match(
    /\b(?:locketgold15s|canvapro|gemini5tb|netflixuhd|damefacebook|dameinstagram|dametiktok|tutbaogiamgiashopee|tutruaip|tutmanguonblackmmo|tooldamefacebook|unlockfacebook282)-[A-Z0-9]{6}\b/i
  );

  return match ? match[0] : null;
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function authorized(req) {
  const expected = process.env.SEPAY_API_KEY || "";
  const received = req.headers.authorization || "";

  const prefix = "Apikey ";

  if (!expected) {
    return false;
  }

  if (!received.startsWith(prefix)) {
    return false;
  }

  const receivedKey = received.slice(prefix.length);

  return timingSafeEqual(receivedKey, expected);
}

export default async function handler(req, res) {
  setCors(res, req);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return generateResponse(
      res,
      req,
      {
        success: false,
        error: "METHOD_NOT_ALLOWED"
      },
      405
    );
  }

  if (!authorized(req)) {
    return generateResponse(
      res,
      req,
      {
        success: false,
        error: "UNAUTHORIZED"
      },
      401
    );
  }

  try {
    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const sepayId = Number(payload?.id);
    const transferAmount = Number(payload?.transferAmount);
    const transferType = String(
      payload?.transferType || ""
    ).toLowerCase();

    if (!Number.isSafeInteger(sepayId) || sepayId <= 0) {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "INVALID_SEPAY_ID"
      });
    }

    if (transferType !== "in") {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "NOT_INCOMING_TRANSFER"
      });
    }

    if (
      !Number.isSafeInteger(transferAmount) ||
      transferAmount <= 0
    ) {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "INVALID_TRANSFER_AMOUNT"
      });
    }

    const duplicate = await sql`
      SELECT payment_id
      FROM payments
      WHERE sepay_transaction_id = ${sepayId}
      LIMIT 1
    `;

    if (duplicate.length) {
      return generateResponse(res, req, {
        success: true,
        duplicate: true
      });
    }

    const code =
      String(payload?.code || "").trim() ||
      extractCode(payload?.content);

    if (!code) {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "NO_PAYMENT_CODE"
      });
    }

    const payments = await sql`
      SELECT
        payment_id,
        amount,
        status,
        expires_at
      FROM payments
      WHERE code = ${code}
      LIMIT 1
    `;

    if (!payments.length) {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_FOUND"
      });
    }

    const payment = payments[0];

    if (payment.status !== "PENDING") {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_PENDING"
      });
    }

    if (Number(payment.amount) !== transferAmount) {
      return generateResponse(res, req, {
        success: true,
        ignored: true,
        reason: "AMOUNT_MISMATCH"
      });
    }

    if (
      new Date(payment.expires_at).getTime() <= Date.now()
    ) {
      await sql`
        UPDATE payments
        SET
          status = 'EXPIRED',
          updated_at = NOW()
        WHERE payment_id = ${payment.payment_id}
          AND status = 'PENDING'
      `;

      return generateResponse(res, req, {
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
        sepay_reference_code = ${
          String(payload?.referenceCode || "").trim() || null
        },
        paid_at = NOW(),
        updated_at = NOW()
      WHERE payment_id = ${payment.payment_id}
        AND status = 'PENDING'
        AND amount = ${transferAmount}
        AND expires_at > NOW()
        AND sepay_transaction_id IS NULL
      RETURNING
        payment_id,
        status
    `;

    if (!updated.length) {
      return generateResponse(res, req, {
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

    return generateResponse(res, req, {
      success: true,
      paid: true,
      payment_id: payment.payment_id
    });
  } catch (error) {
    console.error("SEPAY WEBHOOK ERROR:", error);

    return generateResponse(
      res,
      req,
      {
        success: false,
        error: "WEBHOOK_PROCESSING_FAILED"
      },
      500
    );
  }
}
