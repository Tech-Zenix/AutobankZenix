import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const sql = neon(process.env.DATABASE_URL);

const ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS || "*";

function setCors(res, req) {

  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS === "*") {

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

  } else {

    const origins =
      ALLOWED_ORIGINS
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
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );
}

function response(
  res,
  req,
  body,
  status = 200
) {

  setCors(res, req);

  return res
    .status(status)
    .json(body);
}


/*
 * Tìm mã thanh toán trong nội dung giao dịch.
 *
 * Format chính:
 *
 * ZNX + 10 ký tự
 *
 * Ví dụ:
 *
 * ZNXA81K29P7Q
 *
 * Đồng thời hỗ trợ một số format cũ
 * để không làm hỏng các đơn cũ.
 */

function extractCode(content) {

  const text =
    String(content || "")
      .trim();

  /*
   * Format mới:
   * ZNX + 10 ký tự
   */

  const newFormat =
    text.match(
      /\bZNX[A-Z0-9]{10}\b/i
    );

  if (newFormat) {
    return newFormat[0].toUpperCase();
  }

  /*
   * Format cũ:
   * prefix-XXXXXX
   */

  const legacyFormat =
    text.match(
      /\b(?:locketgold15s|canvapro|gemini5tb|netflixuhd|damefacebook|dameinstagram|dametiktok|tutbaogiamgiashopee|tutruaip|tutmanguonblackmmo|tooldamefacebook|unlockfacebook282)-[A-Z0-9]{6}\b/i
    );

  if (legacyFormat) {
    return legacyFormat[0];
  }

  return null;
}


/*
 * So sánh chuỗi theo kiểu constant-time.
 */

function timingSafeEqual(a, b) {

  if (!a || !b) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {

    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}


/*
 * Kiểm tra Authorization header từ SePay.
 *
 * Format:
 *
 * Authorization: Apikey YOUR_API_KEY
 */

function authorized(req) {

  const expected =
    process.env.SEPAY_API_KEY || "";

  const received =
    req.headers.authorization || "";

  const prefix = "Apikey ";

  if (!expected) {
    return false;
  }

  if (!received.startsWith(prefix)) {
    return false;
  }

  const receivedKey =
    received.slice(prefix.length);

  return timingSafeEqual(
    receivedKey,
    expected
  );
}


export default async function handler(
  req,
  res
) {

  setCors(res, req);

  /*
   * OPTIONS
   */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /*
   * Chỉ nhận POST.
   */

  if (req.method !== "POST") {

    return response(
      res,
      req,
      {
        success: false,
        error: "METHOD_NOT_ALLOWED"
      },
      405
    );
  }

  /*
   * Xác thực SePay.
   */

  if (!authorized(req)) {

    console.error(
      "SEPAY WEBHOOK UNAUTHORIZED"
    );

    return response(
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

    /*
     * Parse body.
     */

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    /*
     * ID giao dịch SePay.
     */

    const sepayId =
      Number(payload?.id);

    /*
     * Số tiền giao dịch.
     */

    const transferAmount =
      Number(payload?.transferAmount);

    /*
     * Loại giao dịch.
     *
     * in = tiền vào
     */

    const transferType =
      String(
        payload?.transferType || ""
      ).toLowerCase();

    /*
     * Kiểm tra ID SePay.
     */

    if (
      !Number.isSafeInteger(sepayId) ||
      sepayId <= 0
    ) {

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "INVALID_SEPAY_ID"
      });
    }

    /*
     * Chỉ xử lý tiền vào.
     */

    if (transferType !== "in") {

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "NOT_INCOMING_TRANSFER"
      });
    }

    /*
     * Kiểm tra amount.
     */

    if (
      !Number.isSafeInteger(
        transferAmount
      ) ||
      transferAmount <= 0
    ) {

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "INVALID_TRANSFER_AMOUNT"
      });
    }

    /*
     * Kiểm tra giao dịch đã từng
     * được dùng cho đơn khác hay chưa.
     */

    const duplicate = await sql`
      SELECT payment_id
      FROM payments
      WHERE sepay_transaction_id = ${sepayId}
      LIMIT 1
    `;

    if (duplicate.length > 0) {

      return response(res, req, {
        success: true,
        duplicate: true
      });
    }

    /*
     * Lấy code.
     *
     * Ưu tiên payload.code của SePay.
     *
     * Nếu code rỗng thì tự tìm trong content.
     */

    const payloadCode =
      String(
        payload?.code || ""
      ).trim();

    const extractedCode =
      extractCode(
        payload?.content
      );

    const code =
      payloadCode ||
      extractedCode;

    /*
     * Không có mã thanh toán.
     */

    if (!code) {

      console.log(
        "SEPAY IGNORED: NO PAYMENT CODE",
        {
          sepayId,
          transferAmount,
          content:
            payload?.content || null
        }
      );

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "NO_PAYMENT_CODE"
      });
    }

    /*
     * Tìm đơn bằng code.
     */

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

    /*
     * Không tìm thấy đơn.
     */

    if (payments.length === 0) {

      console.log(
        "SEPAY IGNORED: PAYMENT NOT FOUND",
        {
          sepayId,
          code,
          transferAmount
        }
      );

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_FOUND"
      });
    }

    const payment =
      payments[0];

    /*
     * Đơn phải đang PENDING.
     */

    if (
      payment.status !== "PENDING"
    ) {

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_NOT_PENDING"
      });
    }

    /*
     * Kiểm tra chính xác số tiền.
     */

    if (
      Number(payment.amount) !==
      transferAmount
    ) {

      console.log(
        "SEPAY IGNORED: AMOUNT MISMATCH",
        {
          payment_id:
            payment.payment_id,

          expected:
            Number(payment.amount),

          received:
            transferAmount,

          code
        }
      );

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "AMOUNT_MISMATCH"
      });
    }

    /*
     * Kiểm tra thời hạn đơn.
     */

    if (
      new Date(
        payment.expires_at
      ).getTime() <= Date.now()
    ) {

      await sql`
        UPDATE payments

        SET
          status = 'EXPIRED',
          updated_at = NOW()

        WHERE payment_id =
          ${payment.payment_id}

          AND status = 'PENDING'
      `;

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_EXPIRED"
      });
    }

    /*
     * Chuyển PENDING -> PAID.
     *
     * Các điều kiện được kiểm tra lại
     * ngay trong câu UPDATE để tránh
     * race condition.
     */

    const updated = await sql`
      UPDATE payments

      SET
        status = 'PAID',

        sepay_transaction_id =
          ${sepayId},

        sepay_reference_code =
          ${
            String(
              payload?.referenceCode || ""
            ).trim() || null
          },

        paid_at = NOW(),

        updated_at = NOW()

      WHERE payment_id =
        ${payment.payment_id}

        AND status = 'PENDING'

        AND amount =
          ${transferAmount}

        AND expires_at > NOW()

        AND sepay_transaction_id IS NULL

      RETURNING
        payment_id,
        status
    `;

    /*
     * UPDATE không thành công.
     */

    if (updated.length === 0) {

      return response(res, req, {
        success: true,
        ignored: true,
        reason: "PAYMENT_ALREADY_UPDATED"
      });
    }

    /*
     * Log server.
     */

    console.log(
      "PAYMENT PAID",
      {
        payment_id:
          payment.payment_id,

        sepay_id:
          sepayId,

        reference_code:
          payload?.referenceCode || null,

        amount:
          transferAmount,

        code
      }
    );

    /*
     * Báo SePay xử lý thành công.
     */

    return response(res, req, {
      success: true,
      paid: true,
      payment_id:
        payment.payment_id
    });

  } catch (error) {

    console.error(
      "SEPAY WEBHOOK ERROR:",
      error
    );

    return response(
      res,
      req,
      {
        success: false,
        error:
          "WEBHOOK_PROCESSING_FAILED"
      },
      500
    );
  }
}
