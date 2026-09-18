import { randomUUID, randomBytes } from "node:crypto";
import { sql } from "../_db.js";
import { json, options } from "../_cors.js";

export const runtime = "nodejs";

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
    name: "Genmini Pro + 5TB Google One",
    amount: 48888,
    prefix: "gemini5tb"
  }
};

function makeCode(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}-${suffix}`;
}

function normalizeProduct(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return options(request);

  if (request.method !== "POST") {
    return json(request, {
      success: false,
      error: "METHOD_NOT_ALLOWED"
    }, 405);
  }

  try {
    const body = await request.json();
    const productKey = normalizeProduct(body?.product);
    const product = PRODUCTS[productKey];

    if (!product) {
      return json(request, {
        success: false,
        error: "INVALID_PRODUCT",
        message: "Sản phẩm không hợp lệ."
      }, 400);
    }

    const paymentId = randomUUID().replaceAll("-", "");
    const code = makeCode(product.prefix);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await sql`
      INSERT INTO payments (
        payment_id, product, amount, code, status,
        expires_at, created_at, updated_at
      )
      VALUES (
        ${paymentId}, ${productKey}, ${product.amount}, ${code}, 'PENDING',
        ${expiresAt.toISOString()}, NOW(), NOW()
      )
    `;

    return json(request, {
      success: true,
      payment_id: paymentId,
      product: productKey,
      product_name: product.name,
      amount: product.amount,
      code,
      status: "PENDING",
      expires_at: expiresAt.toISOString()
    }, 201);
  } catch (error) {
    console.error("payment/create error", error);
    return json(request, {
      success: false,
      error: "CREATE_PAYMENT_FAILED",
      message: "Không thể tạo yêu cầu thanh toán."
    }, 500);
  }
}
