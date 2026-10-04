export default async function handler(req, res) {
  // 1. Luôn bật CORS đầu tiên để trình duyệt không bao giờ bị 'Failed to fetch'
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  // Xử lý preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shin_18122010';
  const authPass = req.headers['x-admin-password'] || (req.body && req.body.admin_password) || req.query.admin_password;

  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Mật khẩu quản trị không hợp lệ.' });
  }

  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL;

  // 2. Lấy danh sách đơn hàng
  if (req.method === 'GET') {
    if (!dbUrl) {
      // Nếu chưa có DB -> trả về mảng rỗng 200 OK thay vì báo lỗi đỏ
      return res.status(200).json({ success: true, orders: [] });
    }

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      const { status } = req.query || {};

      let orders = [];
      if (status && status !== 'ALL') {
        orders = await sql`
          SELECT o.*, p.name AS product_name, p.category, p.package 
          FROM orders o LEFT JOIN products p ON o.product_id = p.id 
          WHERE o.status = ${status} 
          ORDER BY o.created_at DESC LIMIT 100
        `;
      } else {
        orders = await sql`
          SELECT o.*, p.name AS product_name, p.category, p.package 
          FROM orders o LEFT JOIN products p ON o.product_id = p.id 
          ORDER BY o.created_at DESC LIMIT 100
        `;
      }

      return res.status(200).json({ success: true, orders: orders || [] });
    } catch (err) {
      console.warn('Lỗi đọc đơn hàng từ DB:', err.message);
      // Khi DB chưa có dữ liệu đơn nào -> trả về mảng rỗng sạch đẹp
      return res.status(200).json({ success: true, orders: [], db_note: err.message });
    }
  }

  // 3. Cập nhật bàn giao sản phẩm
  if (req.method === 'POST') {
    const { payment_id, delivery_content, delivery_link, status } = req.body || {};
    if (!payment_id) {
      return res.status(400).json({ success: false, error: 'Thiếu payment_id.' });
    }

    if (!dbUrl) {
      return res.status(500).json({ success: false, error: 'Chưa kết nối được Neon Database.' });
    }

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      const nextStatus = status || 'DELIVERED';

      await sql`
        UPDATE orders
        SET delivery_content = ${delivery_content},
            delivery_link = ${delivery_link},
            status = ${nextStatus},
            delivered_at = CURRENT_TIMESTAMP
        WHERE payment_id = ${payment_id}
      `;
      return res.status(200).json({ success: true, message: 'Đã cập nhật bàn giao cho khách.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
