import { getDb, ADMIN_PASSWORD } from '../db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authPass = req.headers['x-admin-password'] || (req.body && req.body.admin_password);
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Mật khẩu không hợp lệ.' });
  }

  const sql = getDb();
  if (!sql) return res.status(500).json({ success: false, error: 'DB not connected' });

  // Lấy danh sách đơn hàng
  if (req.method === 'GET') {
    const { status } = req.query || {};
    try {
      let orders;
      if (status && status !== 'ALL') {
        orders = await sql`
          SELECT o.*, p.name AS product_name, p.category, p.package 
          FROM orders o LEFT JOIN products p ON o.product_id = p.id 
          WHERE o.status = ${status} ORDER BY o.created_at DESC LIMIT 100
        `;
      } else {
        orders = await sql`
          SELECT o.*, p.name AS product_name, p.category, p.package 
          FROM orders o LEFT JOIN products p ON o.product_id = p.id 
          ORDER BY o.created_at DESC LIMIT 100
        `;
      }
      return res.status(200).json({ success: true, orders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Cập nhật bàn giao sản phẩm cho khách
  if (req.method === 'POST') {
    const { payment_id, delivery_content, delivery_link, status } = req.body || {};
    const nextStatus = status || 'DELIVERED';
    try {
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
