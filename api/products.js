import { getDb, ADMIN_PASSWORD } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  const sql = getDb();

  // Khách & Admin lấy danh sách sản phẩm
  if (req.method === 'GET') {
    if (!sql) return res.status(500).json({ success: false, error: 'DB not connected' });
    try {
      const rows = await sql`SELECT * FROM products WHERE status = 'active' ORDER BY is_featured DESC, created_at ASC`;
      return res.status(200).json({ success: true, products: rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Admin xác thực mật khẩu
  const authPass = req.headers['x-admin-password'] || (req.body && req.body.admin_password);
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Mật khẩu bảo mật không hợp lệ.' });
  }

  // Admin thêm mới hoặc sửa giá sản phẩm
  if (req.method === 'POST') {
    const { id, name, category, amount, old_amount, package: pkg, description, image_url, badge, stock_status, is_featured } = req.body || {};
    if (!id || !name || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Thiếu ID, Tên hoặc Giá sản phẩm.' });
    }

    try {
      await sql`
        INSERT INTO products (
          id, name, category, amount, old_amount, package, description, image_url,
          rating, stock_status, badge, is_featured, status, updated_at
        ) VALUES (
          ${id.trim().toLowerCase()}, ${name.trim()}, ${category || 'Ứng dụng'},
          ${parseInt(amount)}, ${old_amount ? parseInt(old_amount) : parseInt(amount) * 2},
          ${pkg || 'Vĩnh viễn'}, ${description || ''},
          ${image_url || 'https://placehold.co/128x128/1c1c24/00f0ff?text=ZENIX'},
          '★ 5.0 (99+)', ${stock_status || 'Còn hàng'}, ${badge || 'TỰ ĐỘNG'},
          ${Boolean(is_featured)}, 'active', CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          amount = EXCLUDED.amount,
          old_amount = EXCLUDED.old_amount,
          package = EXCLUDED.package,
          description = EXCLUDED.description,
          image_url = CASE WHEN EXCLUDED.image_url != '' THEN EXCLUDED.image_url ELSE products.image_url END,
          stock_status = EXCLUDED.stock_status,
          badge = EXCLUDED.badge,
          updated_at = CURRENT_TIMESTAMP
      `;
      return res.status(200).json({ success: true, message: `Đã lưu sản phẩm [${name}] thành công.` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
