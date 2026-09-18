import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);

const PRODUCTS = {
  locketgold15s: {
    name: "Locket Gold 15s",
    amount: 40000,
    prefix: "locketgold15s"
  },

  canvapro: {
    name: "Canva Pro",
    amount: 40000,
    prefix: "canvapro"
  },

  gemini5tb: {
    name: "Genimi Pro + Google One 5TB - 18 Months",
    amount: 48888,
    prefix: "gemini5tb"
  }
};

function setCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGINS || "*";
  const origin = req.headers.origin;

  if (allowed === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const origins = allowed
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );
}

function generatePaymentCode(prefix) {
  const random = randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 6);

  return `${prefix}-${random}`;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const body = req.body || {};
    const productId = String(body.product || "").trim();

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "Thiếu mã sản phẩm."
      });
    }

    const product = PRODUCTS[productId];

    if (!product) {
      return res.status(400).json({
        success: false,
        error: "Sản phẩm không tồn tại.",
        product: productId
      });
    }

    const paymentId = randomUUID();

    const code = generatePaymentCode(product.prefix);

    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await sql`
      INSERT INTO payments (
        payment_id,
        product,
        amount,
        code,
        status,
        expires_at,
        created_at,
        updated_at
      )
      VALUES (
        ${paymentId},
        ${productId},
        ${product.amount},
        ${code},
        'PENDING',
        ${expiresAt},
        NOW(),
        NOW()
      )
    `;

    return res.status(201).json({
      success: true,

      payment_id: paymentId,

      product: productId,

      product_name: product.name,

      amount: product.amount,

      code,

      status: "PENDING",

      expires_at: expiresAt.toISOString()
    });

  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Không thể tạo đơn thanh toán."
    });
  }
}
