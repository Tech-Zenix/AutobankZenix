import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);

/*
|--------------------------------------------------------------------------
| DANH SÁCH SẢN PHẨM ZENIX LAB
|--------------------------------------------------------------------------
|
| amount = số tiền backend yêu cầu khách chuyển khoản.
|
| QUAN TRỌNG:
| Website không được tự gửi amount.
| Backend tự lấy amount từ danh sách này.
|
*/

const PRODUCTS = {

  // 01
  locketgold15s: {
    name: "Locket Gold 15s",
    amount: 40000,
    package: "Vĩnh viễn",
    prefix: "locketgold15s"
  },

  // 02
  canvapro: {
    name: "Canva Pro",
    amount: 40000,
    package: "1 Year",
    prefix: "canvapro"
  },

  // 03
  gemini5tb: {
    name: "Genimi Pro + 5TB Google One",
    amount: 48888,
    package: "18 Months",
    prefix: "gemini5tb"
  },

  // 04
  netflixuhd: {
    name: "Netflix UHD Chính chủ",
    amount: 35000,
    package: "1 Month",
    prefix: "netflixuhd"
  },

  // 05
  damefacebook: {
    name: "Dame tài khoản Facebook",
    amount: 150000,
    package: "1 acc",
    prefix: "damefacebook"
  },

  // 06
  dameinstagram: {
    name: "Dame tài khoản Instagram",
    amount: 75000,
    package: "1 acc",
    prefix: "dameinstagram"
  },

  // 07
  dametiktok: {
    name: "Dame tài khoản Tiktok",
    amount: 150000,
    package: "1 acc",
    prefix: "dametiktok"
  },

  // 08
  tutbaogiamgiashopee: {
    name: "Tut Bào Giảm giá Shopee",
    amount: 50000,
    package: "1 tut",
    prefix: "tutshopee"
  },

  // 09
  tutruaip: {
    name: "Tut Rửa I.P",
    amount: 35000,
    package: "1 tut",
    prefix: "tutruaip"
  },

  // 10
  tutmanguonblackmmo: {
    name: "Tut Mã Nguồn - Black MMO",
    amount: 2000000,
    package: "1 tut",
    prefix: "tutmanguon"
  },

  // 11
  tooldamefacebook: {
    name: "Tool Dame Facebook",
    amount: 100000,
    package: "1 tool",
    prefix: "tooldamefb"
  },

  // 12
  unlockfacebook282: {
    name: "Unlock acc Facebook 180 ngày",
    amount: 150000,
    package: "1 acc",
    prefix: "unlockfb282"
  }

};


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

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
      .map(x => x.trim())
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
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );

}


/*
|--------------------------------------------------------------------------
| TẠO MÃ THANH TOÁN
|--------------------------------------------------------------------------
*/

function generatePaymentCode(prefix) {

  const random = randomBytes(4)
    .toString("hex")
    .toUpperCase()
    .slice(0, 6);

  return `${prefix}-${random}`;

}


/*
|--------------------------------------------------------------------------
| API CREATE PAYMENT
|--------------------------------------------------------------------------
*/

export default async function handler(req, res) {

  setCors(req, res);


  /*
  |--------------------------------------------------------------------------
  | OPTIONS
  |--------------------------------------------------------------------------
  */

  if (req.method === "OPTIONS") {

    return res
      .status(204)
      .end();

  }


  /*
  |--------------------------------------------------------------------------
  | CHỈ CHO PHÉP POST
  |--------------------------------------------------------------------------
  */

  if (req.method !== "POST") {

    return res
      .status(405)
      .json({
        success: false,
        error: "Method Not Allowed"
      });

  }


  try {

    /*
    |--------------------------------------------------------------------------
    | LẤY PRODUCT ID
    |--------------------------------------------------------------------------
    */

    const body = req.body || {};

    const productId =
      String(
        body.product || ""
      ).trim();


    /*
    |--------------------------------------------------------------------------
    | KIỂM TRA PRODUCT
    |--------------------------------------------------------------------------
    */

    if (!productId) {

      return res
        .status(400)
        .json({
          success: false,
          error: "Thiếu mã sản phẩm."
        });

    }


    const product =
      PRODUCTS[productId];


    if (!product) {

      return res
        .status(400)
        .json({
          success: false,
          error: "Sản phẩm không tồn tại.",
          product: productId
        });

    }


    /*
    |--------------------------------------------------------------------------
    | TẠO PAYMENT ID
    |--------------------------------------------------------------------------
    */

    const paymentId =
      randomUUID();


    /*
    |--------------------------------------------------------------------------
    | TẠO CODE CHUYỂN KHOẢN
    |--------------------------------------------------------------------------
    */

    const code =
      generatePaymentCode(
        product.prefix
      );


    /*
    |--------------------------------------------------------------------------
    | HẠN THANH TOÁN 15 PHÚT
    |--------------------------------------------------------------------------
    */

    const expiresAt =
      new Date(
        Date.now() +
        15 * 60 * 1000
      );


    /*
    |--------------------------------------------------------------------------
    | LƯU DATABASE
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | TRẢ KẾT QUẢ
    |--------------------------------------------------------------------------
    */

    return res
      .status(201)
      .json({

        success: true,

        payment_id:
          paymentId,

        product:
          productId,

        product_name:
          product.name,

        amount:
          product.amount,

        package:
          product.package,

        code:
          code,

        status:
          "PENDING",

        expires_at:
          expiresAt.toISOString()

      });


  } catch (error) {

    console.error(
      "CREATE PAYMENT ERROR:",
      error
    );


    return res
      .status(500)
      .json({

        success: false,

        error:
          "Không thể tạo đơn thanh toán."

      });

  }

}
