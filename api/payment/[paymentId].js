import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const PRODUCTS = {
  locketgold15s: {
    name: "Locket Gold 15s",
    package: "Vĩnh viễn"
  },

  canvapro: {
    name: "Canva Pro",
    package: "1 Year"
  },

  gemini5tb: {
    name: "Genimi Pro + 5TB Google One",
    package: "18 Months"
  },

  netflixuhd: {
    name: "Netflix UHD Chính chủ",
    package: "1 Month"
  },

  damefacebook: {
    name: "Dame tài khoản Facebook",
    package: "1 acc"
  },

  dameinstagram: {
    name: "Dame tài khoản Instagram",
    package: "1 acc"
  },

  dametiktok: {
    name: "Dame tài khoản Tiktok",
    package: "1 acc"
  },

  tutbaogiamgiashopee: {
    name: "Tut Bào Giảm giá Shopee",
    package: "1 tut"
  },

  tutruaip: {
    name: "Tut Rửa I.P",
    package: "1 tut"
  },

  tutmanguonblackmmo: {
    name: "Tut Mã Nguồn - Black MMO",
    package: "1 tut"
  },

  tooldamefacebook: {
    name: "Tool Dame Facebook",
    package: "1 tool"
  },

  unlockfacebook282: {
    name: "Unlock acc Facebook 180 ngày",
    package: "1 acc"
  }
};

function setCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGINS || "*";

  const origin = req.headers.origin;

  if (allowed === "*") {

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

  } else {

    const origins = allowed
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (
      origin &&
      origins.includes(origin)
    ) {
      res.setHeader(
        "Access-Control-Allow-Origin",
        origin
      );
    }
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
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

function getTutUrl(product) {

  const urls = {
    locketgold15s:
      process.env.TUT_URL_LOCKETGOLD15S,

    canvapro:
      process.env.TUT_URL_CANVAPRO,

    gemini5tb:
      process.env.TUT_URL_GEMINI5TB,

    netflixuhd:
      process.env.TUT_URL_NETFLIXUHD,

    damefacebook:
      process.env.TUT_URL_DAMEFACEBOOK,

    dameinstagram:
      process.env.TUT_URL_DAMEINSTAGRAM,

    dametiktok:
      process.env.TUT_URL_DAMETIKTOK,

    tutbaogiamgiashopee:
      process.env.TUT_URL_TUTSHOPEE,

    tutruaip:
      process.env.TUT_URL_TUTRUAIP,

    tutmanguonblackmmo:
      process.env.TUT_URL_TUTMANGUON,

    tooldamefacebook:
      process.env.TUT_URL_TOOLDAMEFB,

    unlockfacebook282:
      process.env.TUT_URL_UNLOCKFB282
  };

  return urls[product] || null;
}

export default async function handler(req, res) {

  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {

    const paymentId =
      String(
        req.query?.paymentId || ""
      ).trim();

    if (!paymentId) {

      return res.status(400).json({
        success: false,
        error: "Thiếu payment_id."
      });
    }

    const rows = await sql`
      SELECT
        payment_id,
        product,
        amount,
        code,
        status,
        expires_at,
        paid_at,
        sepay_transaction_id,
        sepay_reference_code,
        created_at,
        updated_at
      FROM payments
      WHERE payment_id = ${paymentId}
      LIMIT 1
    `;

    if (rows.length === 0) {

      return res.status(404).json({
        success: false,
        error: "Không tìm thấy đơn thanh toán."
      });
    }

    let payment = rows[0];

    /*
     * Nếu đơn PENDING đã quá 15 phút
     * thì chuyển sang EXPIRED.
     */

    if (
      payment.status === "PENDING" &&
      new Date(payment.expires_at).getTime() <= Date.now()
    ) {

      const expiredRows = await sql`
        UPDATE payments

        SET
          status = 'EXPIRED',
          updated_at = NOW()

        WHERE payment_id = ${paymentId}
          AND status = 'PENDING'

        RETURNING
          payment_id,
          product,
          amount,
          code,
          status,
          expires_at,
          paid_at,
          sepay_transaction_id,
          sepay_reference_code,
          created_at,
          updated_at
      `;

      if (expiredRows.length > 0) {
        payment = expiredRows[0];
      }
    }

    /*
     * Chỉ trả link sản phẩm
     * khi đơn đã PAID.
     */

    let tutUrl = null;

    if (payment.status === "PAID") {
      tutUrl = getTutUrl(payment.product);
    }

    const productInfo =
      PRODUCTS[payment.product] || {
        name: payment.product,
        package: ""
      };

    return res.status(200).json({

      success: true,

      payment_id:
        payment.payment_id,

      product:
        payment.product,

      product_name:
        productInfo.name,

      package:
        productInfo.package,

      amount:
        Number(payment.amount),

      code:
        payment.code,

      status:
        payment.status,

      expires_at:
        payment.expires_at,

      paid_at:
        payment.paid_at,

      tut_url:
        tutUrl

    });

  } catch (error) {

    console.error(
      "GET PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Không thể kiểm tra đơn thanh toán."
    });
  }
}
