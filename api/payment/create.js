import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);

const PRODUCTS = {
  locketgold15s: {
    name: "Locket Gold 15s",
    amount: 40000,
    package: "Vĩnh viễn",
    prefix: "locketgold15s"
  },

  canvapro: {
    name: "Canva Pro",
    amount: 40000,
    package: "1 Year",
    prefix: "canvapro"
  },

  gemini5tb: {
    name: "Genimi Pro + 5TB Google One",
    amount: 48888,
    package: "18 Months",
    prefix: "gemini5tb"
  },

  netflixuhd: {
    name: "Netflix UHD Chính chủ",
    amount: 35000,
    package: "1 Month",
    prefix: "netflixuhd"
  },

  damefacebook: {
    name: "Dame tài khoản Facebook",
    amount: 150000,
    package: "1 acc",
    prefix: "damefacebook"
  },

  dameinstagram: {
    name: "Dame tài khoản Instagram",
    amount: 75000,
    package: "1 acc",
    prefix: "dameinstagram"
  },

  dametiktok: {
    name: "Dame tài khoản Tiktok",
    amount: 150000,
    package: "1 acc",
    prefix: "dametiktok"
  },

  tutbaogiamgiashopee: {
    name: "Tut Bào Giảm giá Shopee",
    amount: 50000,
    package: "1 tut",
    prefix: "tutshopee"
  },

  tutruaip: {
    name: "Tut Rửa I.P",
    amount: 35000,
    package: "1 tut",
    prefix: "tutruaip"
  },

  tutmanguonblackmmo: {
    name: "Tut Mã Nguồn - Black MMO",
    amount: 2000000,
    package: "1 tut",
    prefix: "tutmanguon"
  },

  tooldamefacebook: {
    name: "Tool Dame Facebook",
    amount: 100000,
    package: "1 tool",
    prefix: "tooldamefb"
  },

  unlockfacebook282: {
    name: "Unlock acc Facebook 180 ngày",
    amount: 150000,
    package: "1 acc",
    prefix: "unlockfb282"
  },
  
  mokhoagioihanai: {
    name: "Tut ChatGPT",
    amount: 125000,
    package: "1 tut",
    prefix: "mokhoagioihanai"
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
      .map((x) => x.trim())
      .filter(Boolean);

    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function generatePaymentCode() {
  /*
   * Format:
   * ZNX + 10 ký tự
   *
   * Ví dụ:
   * ZNXA81K29P7Q
   *
   * SePay nên được cấu hình Payment Code:
   * Prefix: ZNX
   * Suffix: 10 ký tự
   */

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let random = "";

  const bytes = randomBytes(10);

  for (let i = 0; i < 10; i++) {
    random += chars[bytes[i] % chars.length];
  }

  return `ZNX${random}`;
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

    /*
     * payment_id được tạo hoàn toàn ở backend.
     */
    const paymentId = randomUUID();

    /*
     * code được tạo hoàn toàn ở backend.
     */
    const code = generatePaymentCode();

    /*
     * Đơn có hiệu lực 15 phút.
     */
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

      package: product.package,

      code,

      status: "PENDING",

      expires_at: expiresAt.toISOString()
    });

  } catch (error) {

    console.error(
      "CREATE PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Không thể tạo đơn thanh toán."
    });
  }
}
