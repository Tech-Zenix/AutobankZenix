import { getDb } from '../db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const payment_id = req.query.payment_id;
  if (!payment_id) return res.status(400).json({ success: false, error: 'Thiếu mã đơn hàng.' });

  const sql = getDb();
  if (!sql) return res.status(500).json({ success: false, error: 'DB not connected' });

  try {
    const rows = await sql`
      SELECT o.*, p.name AS product_name, p.package 
      FROM orders o LEFT JOIN products p ON o.product_id = p.id 
      WHERE o.payment_id = ${payment_id.trim()}
    `;

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đơn hàng này.' });
    }

    const order = rows[0];
    if (order.status === 'PENDING') {
      return res.status(200).json({
        success: true,
        can_claim: false,
        status: 'PENDING',
        message: 'Đơn hàng đang chờ thanh toán.'
      });
    }

    return res.status(200).json({
      success: true,
      can_claim: true,
      status: order.status,
      delivery: {
        payment_id: order.payment_id,
        product_name: order.product_name,
        package: order.package,
        amount: order.amount,
        delivery_content: order.delivery_content || 'Đang cập nhật nội dung bàn giao...',
        delivery_link: order.delivery_link || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
