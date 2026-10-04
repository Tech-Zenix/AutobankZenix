import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes } from "node:crypto";

// Hỗ trợ cả NEON_DATABASE_URL và DATABASE_URL
const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const sql = dbUrl ? neon(dbUrl) : null;

// Danh sách dự phòng nếu Database chưa phản hồi kịp
const FALLBACK_PRODUCTS = {
  locketgold15s: { name: "Locket Gold 15s", amount: 40000, package: "Vĩnh viễn" },
  canvapro: { name: "Canva Pro", amount: 40000, package: "1 Year" },
  gemini5tb: { name: "Genimi Pro + 5TB Google One", amount: 48888, package: "18 Months" },
  netflixuhd: { name: "Netflix UHD Chính chủ", amount: 35000, package: "1 Month" },
  damefacebook: { name: "Dame tài khoản Facebook", amount: 150000, package: "1 acc" },
  dameinstagram: { name: "Dame tài khoản Instagram", amount: 75000, package: "1 acc" },
  dametiktok: { name: "Dame tài khoản Tiktok", amount: 150000, package: "1 acc" },
  tutbaogiamgiashopee: { name: "Tut Bào Giảm giá Shopee", amount: 50000, package: "1 tut" },
  tutruaip: { name: "Tut Rửa I.P", amount: 35000, package: "1 tut" },
  tutmanguonblackmmo: { name: "Tut Mã Nguồn - Black MMO", amount: 2000000, package: "1 tut" },
  tooldamefacebook: { name: "Tool Dame Facebook", amount: 100000, package: "1 tool" },
  unlockfacebook282: { name: "Unlock acc Facebook 180 ngày", amount: 150000, package: "1 acc" },
  mokhoagioihanai: { name: "Tut ChatGPT", amount: 125000, package: "1 tut" }
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
    const productId = String(body.product || "").trim().toLowerCase();

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "Thiếu mã sản phẩm."
      });
    }

    let product = null;

    // 1. ƯU TIÊN ĐỌC GIÁ MỚI NHẤT & SẢN PHẨM MỚI TỪ NEON DATABASE
    if (sql) {
      try {
        const rows = await sql`
          SELECT name, amount, package, delivery_link 
          FROM products 
          WHERE id = ${productId} AND status = 'active'
        `;
        if (rows && rows.length > 0) {
          product = {
            name: rows[0].name,
            amount: parseInt(rows[0].amount),
            package: rows[0].package,
            delivery_link: rows[0].delivery_link || ""
          };
        }
      } catch (dbErr) {
        console.warn("Lỗi đọc giá từ Neon DB, dùng dữ liệu dự phòng:", dbErr.message);
      }
    }

    // 2. Nếu DB chưa có hoặc đang lỗi -> lấy từ danh sách dự phòng
    if (!product && FALLBACK_PRODUCTS[productId]) {
      product = FALLBACK_PRODUCTS[productId];
    }

    if (!product) {
      return res.status(400).json({
        success: false,
        error: "Sản phẩm không tồn tại.",
        product: productId
      });
    }

    const paymentId = randomUUID();
    const code = generatePaymentCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 3. Tự động đảm bảo bảng payments có cột delivery_link (nếu chưa có)
    if (sql) {
      try {
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
      } catch (_) {}

      // Lưu đơn thanh toán với GIÁ TIỀN MỚI NHẤT và LINK TRẢ KHÁCH
      await sql`
        INSERT INTO payments (
          payment_id,
          product,
          amount,
          code,
          status,
          expires_at,
          created_at,
          updated_at,
          delivery_link
        )
        VALUES (
          ${paymentId},
          ${productId},
          ${product.amount},
          ${code},
          'PENDING',
          ${expiresAt},
          NOW(),
          NOW(),
          ${product.delivery_link || ''}
        )
      `;
    }

    // 4. Trả về đúng số tiền mới cho giao diện thanh toán & mã VietQR
    return res.status(201).json({
      success: true,
      payment_id: paymentId,
      product: productId,
      product_name: product.name,
      amount: product.amount, // Số tiền mới đã được cập nhật từ Admin
      package: product.package,
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
