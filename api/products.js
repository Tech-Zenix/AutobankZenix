import { neon } from "@neondatabase/serverless";

// 1. ĐỌC ĐÚNG BIẾN NEON_DATABASE_URL BẠN ĐÃ CÀI TRÊN VERCEL
const dbUrl = 
  process.env.NEON_DATABASE_URL || 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  "";

// Chỉ khởi tạo Neon nếu có chuỗi kết nối hợp lệ (tránh văng lỗi crash 500)
let sql = null;
if (dbUrl && typeof dbUrl === "string" && dbUrl.startsWith("postgres")) {
  try {
    sql = neon(dbUrl);
  } catch (err) {
    console.error("Lỗi khởi tạo Neon:", err);
  }
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shin_18122010';

// 13 sản phẩm dự phòng chuẩn của ZENIX LAB
const FALLBACK_PRODUCTS = [
  { id: 'locketgold15s', name: 'Locket Gold 15s', category: 'Ứng dụng', amount: 40000, old_amount: 70000, package: 'Vĩnh viễn', delivery_link: '', image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkwXtsvWEAwWrpOcUI4FHS4ouCrpCZhPHHLe8icVeDQBmfD-a-32VdGjY&s=10' },
  { id: 'canvapro', name: 'Canva Pro', category: 'Phần mềm', amount: 40000, old_amount: 100000, package: '1 Year', delivery_link: '', image_url: 'https://static.freepnglogo.com/images/all_img/1691829322canva-app-logo-png.png' },
  { id: 'gemini5tb', name: 'Genimi Pro + 5TB Google One', category: 'Ứng dụng', amount: 48888, old_amount: 273000, package: '18 Months', delivery_link: '', image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg' },
  { id: 'netflixuhd', name: 'Netflix UHD Chính chủ', category: 'Sản Phẩm', amount: 35000, old_amount: 80000, package: '1 Month', delivery_link: '', image_url: 'https://assets.nflxext.com/ffe/siteui/common/icons/monogram/netflix-monogram.png' },
  { id: 'damefacebook', name: 'Dame tài khoản Facebook', category: 'Dịch vụ', amount: 150000, old_amount: 500000, package: '1 acc', delivery_link: '', image_url: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png' },
  { id: 'dameinstagram', name: 'Dame tài khoản Instagram', category: 'Dịch vụ', amount: 75000, old_amount: 150000, package: '1 acc', delivery_link: '', image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png' },
  { id: 'dametiktok', name: 'Dame tài khoản Tiktok', category: 'Dịch vụ', amount: 150000, old_amount: 500000, package: '1 acc', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' },
  { id: 'tutbaogiamgiashopee', name: 'Tut Bào Giảm giá Shopee', category: 'Tut Trick', amount: 50000, old_amount: 100000, package: '1 tut', delivery_link: '', image_url: 'https://cdn.iconscout.com/icon/free/png-256/free-shopee-logo-icon-download-in-svg-png-gif-file-formats--shopping-social-media-pack-logos-icons-3521696.png' },
  { id: 'tutruaip', name: 'Tut Rửa I.P', category: 'Tut Trick', amount: 35000, old_amount: 60000, package: '1 tut', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png' },
  { id: 'tutmanguonblackmmo', name: 'Tut Mã Nguồn - Black MMO', category: 'Tut Trick', amount: 2000000, old_amount: 5000000, package: '1 tut', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/2721/2721295.png' },
  { id: 'tooldamefacebook', name: 'Tool Dame Facebook', category: 'Tools', amount: 100000, old_amount: 300000, package: '1 tool', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png' },
  { id: 'unlockfacebook282', name: 'Unlock acc Facebook 180 ngày', category: 'Dịch vụ', amount: 150000, old_amount: 300000, package: '1 acc', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/3536/3536394.png' },
  { id: 'mokhoagioihanai', name: 'Tut ChatGPT', category: 'Tut Trick', amount: 125000, old_amount: 275000, package: '1 tut', delivery_link: '', image_url: 'https://cdn-icons-png.flaticon.com/512/12222/12222560.png' }
];

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-password");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 1. GET: Lấy danh sách sản phẩm
  if (req.method === "GET") {
    if (!sql) {
      return res.status(200).json({ success: true, source: "fallback_no_db", products: FALLBACK_PRODUCTS });
    }

    try {
      const rows = await sql`
        SELECT id, name, category, amount, old_amount, package, description, image_url, rating, stock_status, badge, is_featured, delivery_link 
        FROM products 
        WHERE status = 'active' 
        ORDER BY is_featured DESC, created_at ASC
      `;
      if (rows && rows.length > 0) {
        return res.status(200).json({ success: true, source: "neon_postgres", products: rows });
      }
      return res.status(200).json({ success: true, source: "fallback_empty_db", products: FALLBACK_PRODUCTS });
    } catch (err) {
      console.warn("Lỗi đọc DB, chuyển danh sách dự phòng:", err.message);
      return res.status(200).json({ success: true, source: "fallback_on_error", products: FALLBACK_PRODUCTS, db_error: err.message });
    }
  }

  // 2. Xác thực mật khẩu Admin
  const authPass = req.headers["x-admin-password"] || (req.body && req.body.admin_password);
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Mật khẩu bảo mật không hợp lệ." });
  }

  // 3. POST: Thêm mới hoặc sửa giá, thời hạn, link trả khách
  if (req.method === "POST") {
    const { id, name, category, amount, old_amount, package: pkg, description, image_url, badge, stock_status, is_featured, delivery_link } = req.body || {};
    if (!id || !name || amount === undefined) {
      return res.status(400).json({ success: false, error: "Thiếu ID, Tên hoặc Giá sản phẩm." });
    }

    if (!sql) {
      return res.status(500).json({ success: false, error: "Chưa kết nối được Neon Database. Vui lòng kiểm tra biến NEON_DATABASE_URL." });
    }

    try {
      try {
        await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
      } catch (_) {}

      await sql`
        INSERT INTO products (
          id, name, category, amount, old_amount, package, description, image_url,
          rating, stock_status, badge, is_featured, delivery_link, status, updated_at
        ) VALUES (
          ${id.trim().toLowerCase()}, ${name.trim()}, ${category || 'Ứng dụng'},
          ${parseInt(amount)}, ${old_amount ? parseInt(old_amount) : parseInt(amount) * 2},
          ${pkg || 'Vĩnh viễn'}, ${description || ''},
          ${image_url || 'https://placehold.co/128x128/1c1c24/00f0ff?text=ZENIX'},
          '★ 5.0 (99+)', ${stock_status || 'Còn hàng'}, ${badge || 'TỰ ĐỘNG'},
          ${Boolean(is_featured)}, ${delivery_link || ''}, 'active', CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          amount = EXCLUDED.amount,
          old_amount = EXCLUDED.old_amount,
          package = EXCLUDED.package,
          description = EXCLUDED.description,
          delivery_link = EXCLUDED.delivery_link,
          updated_at = CURRENT_TIMESTAMP
      `;
      return res.status(200).json({ success: true, message: `Đã lưu sản phẩm [${name}] thành công.` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 4. DELETE: Xóa sản phẩm
  if (req.method === "DELETE") {
    const { id } = req.body || req.query || {};
    if (!id) return res.status(400).json({ success: false, error: "Thiếu ID sản phẩm cần xóa." });
    if (!sql) return res.status(500).json({ success: false, error: "Chưa kết nối được Neon Database." });

    try {
      await sql`UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ${id.trim().toLowerCase()}`;
      return res.status(200).json({ success: true, message: `Đã xóa sản phẩm [${id}] thành công.` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
