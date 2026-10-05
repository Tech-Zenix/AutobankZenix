import { getDb, ADMIN_PASSWORD } from '../db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authPass = req.headers['x-admin-password'] || (req.body && req.body.admin_password) || (req.query && req.query.admin_password);
  if (authPass && authPass !== ADMIN_PASSWORD && authPass.toLowerCase() !== ADMIN_PASSWORD.toLowerCase()) {
    return res.status(401).json({ success: false, error: 'Mật khẩu bảo mật không hợp lệ.' });
  }

  const sql = getDb();
  if (!sql) {
    return res.status(500).json({ success: false, error: 'Chưa cấu hình DATABASE_URL trên Vercel.' });
  }

  // 1. GET: Lấy lịch sử giao dịch và danh sách đơn hàng từ bảng payments
  if (req.method === 'GET') {
    const { status } = req.query || {};
    try {
      try {
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_content TEXT;`;
      } catch (alterErr) {}

      let orders;
      if (status && status !== 'ALL') {
        orders = await sql`
          SELECT 
            p.payment_id,
            p.product AS product_id,
            p.amount,
            p.code,
            p.status,
            p.expires_at,
            p.created_at,
            p.updated_at,
            COALESCE(p.delivery_link, prod.delivery_link, '') AS delivery_link,
            COALESCE(p.delivery_content, '') AS delivery_content,
            COALESCE(prod.name, p.product) AS product_name,
            COALESCE(prod.category, 'Ứng dụng') AS category,
            COALESCE(prod.package, 'Gói mặc định') AS package,
            prod.image_url
          FROM payments p
          LEFT JOIN products prod ON p.product = prod.id
          WHERE p.status = ${status}
          ORDER BY p.created_at DESC
          LIMIT 100
        `;
      } else {
        orders = await sql`
          SELECT 
            p.payment_id,
            p.product AS product_id,
            p.amount,
            p.code,
            p.status,
            p.expires_at,
            p.created_at,
            p.updated_at,
            COALESCE(p.delivery_link, prod.delivery_link, '') AS delivery_link,
            COALESCE(p.delivery_content, '') AS delivery_content,
            COALESCE(prod.name, p.product) AS product_name,
            COALESCE(prod.category, 'Ứng dụng') AS category,
            COALESCE(prod.package, 'Gói mặc định') AS package,
            prod.image_url
          FROM payments p
          LEFT JOIN products prod ON p.product = prod.id
          ORDER BY p.created_at DESC
          LIMIT 100
        `;
      }

      const stats = {
        total_orders: orders.length,
        total_revenue: orders
          .filter(o => o.status === 'PAID' || o.status === 'DELIVERED' || o.status === 'COMPLETED')
          .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0),
        pending_count: orders.filter(o => o.status === 'PENDING').length,
        paid_count: orders.filter(o => o.status === 'PAID' || o.status === 'COMPLETED').length,
        delivered_count: orders.filter(o => o.status === 'DELIVERED').length
      };

      return res.status(200).json({ success: true, stats, orders });
    } catch (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. POST: Cập nhật thông tin bàn giao sản phẩm & đổi trạng thái
  if (req.method === 'POST') {
    const { payment_id, delivery_content, delivery_link, status } = req.body || {};

    if (!payment_id) {
      return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng payment_id.' });
    }

    const nextStatus = status || 'DELIVERED';

    try {
      try {
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_content TEXT;`;
      } catch (e) {}

      await sql`
        UPDATE payments
        SET 
          delivery_content = COALESCE(${delivery_content}, delivery_content),
          delivery_link = COALESCE(${delivery_link}, delivery_link),
          status = ${nextStatus},
          updated_at = NOW()
        WHERE payment_id = ${payment_id}
      `;

      return res.status(200).json({
        success: true,
        message: `Đã cập nhật bàn giao thành công cho đơn [${payment_id}]. Khách hàng đã có thể nhận sản phẩm.`
      });
    } catch (err) {
      console.error('Error updating order delivery:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
