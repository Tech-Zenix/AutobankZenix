import { getDb } from '../db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const payment_id = req.query.payment_id || (req.body && req.body.payment_id);

  if (!payment_id) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp mã đơn hàng (Payment ID).' });
  }

  const sql = getDb();
  if (!sql) {
    return res.status(500).json({ success: false, error: 'Hệ thống cơ sở dữ liệu đang bảo trì.' });
  }

  try {
    try {
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
      await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_content TEXT;`;
    } catch (e) {}

    const rows = await sql`
      SELECT 
        p.payment_id, p.amount, p.status, p.code,
        COALESCE(p.delivery_content, '') AS delivery_content,
        COALESCE(p.delivery_link, prod.delivery_link, '') AS delivery_link,
        p.created_at, p.updated_at,
        COALESCE(prod.name, p.product) AS product_name,
        COALESCE(prod.category, 'Ứng dụng') AS category,
        COALESCE(prod.package, 'Gói mặc định') AS package,
        prod.image_url
      FROM payments p
      LEFT JOIN products prod ON p.product = prod.id
      WHERE p.payment_id = ${payment_id.trim()}
    `;

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông tin đơn hàng với mã giao dịch này. Vui lòng kiểm tra lại.'
      });
    }

    const order = rows[0];

    if (order.status === 'PENDING') {
      return res.status(200).json({
        success: true,
        can_claim: false,
        status: 'PENDING',
        message: 'Đơn hàng đang chờ thanh toán. Vui lòng quét mã VietQR và hoàn tất chuyển khoản trước khi nhận sản phẩm.',
        order: {
          payment_id: order.payment_id,
          product_name: order.product_name,
          amount: order.amount,
          status: order.status
        }
      });
    }

    const deliveryLink = order.delivery_link || '';
    const deliveryContent = order.delivery_content || (deliveryLink ? `Link nhận sản phẩm của bạn: ${deliveryLink}` : 'Đang cập nhật dữ liệu bàn giao từ hệ thống. Quý khách vui lòng chờ 1-3 phút hoặc liên hệ Admin ZENIX LAB.');

    return res.status(200).json({
      success: true,
      can_claim: true,
      status: order.status,
      message: 'Xác thực thanh toán thành công! Sản phẩm của bạn đã sẵn sàng bàn giao.',
      delivery: {
        payment_id: order.payment_id,
        product_name: order.product_name,
        package: order.package,
        amount: order.amount,
        delivery_content: deliveryContent,
        delivery_link: deliveryLink,
        created_at: order.created_at,
        updated_at: order.updated_at
      }
    });

  } catch (err) {
    console.error('Error claiming order:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
