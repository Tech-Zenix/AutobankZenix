export default async function handler(req, res) {
  // 1. Luôn bật CORS để khách từ website nhận được dữ liệu
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const payment_id = String(req.query.payment_id || '').trim();
  if (!payment_id) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp mã đơn hàng.' });
  }

  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    return res.status(500).json({ success: false, error: 'Chưa cấu hình cơ sở dữ liệu.' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(dbUrl);

    // 2. Tra cứu đơn hàng từ bảng payments kết hợp với thông tin sản phẩm
    let rows = await sql`
      SELECT 
        p.payment_id,
        p.product,
        p.amount,
        p.status,
        p.delivery_link AS payment_delivery_link,
        pr.name AS product_name,
        pr.package,
        pr.delivery_link AS product_delivery_link
      FROM payments p
      LEFT JOIN products pr ON p.product = pr.id
      WHERE p.payment_id = ${payment_id}
      LIMIT 1
    `;

    // Nếu không tìm thấy trong payments, tìm tiếp trong bảng orders (nếu có)
    if (!rows || rows.length === 0) {
      rows = await sql`
        SELECT 
          o.payment_id,
          o.product_id AS product,
          o.amount,
          o.status,
          o.delivery_link AS payment_delivery_link,
          o.delivery_content,
          pr.name AS product_name,
          pr.package,
          pr.delivery_link AS product_delivery_link
        FROM orders o
        LEFT JOIN products pr ON o.product_id = pr.id
        WHERE o.payment_id = ${payment_id}
        LIMIT 1
      `;
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy đơn hàng với mã giao dịch này. Vui lòng kiểm tra lại.'
      });
    }

    const order = rows[0];

    // 3. Nếu đơn hàng chưa thanh toán
    if (order.status === 'PENDING') {
      return res.status(200).json({
        success: true,
        can_claim: false,
        status: 'PENDING',
        message: 'Đơn hàng đang chờ thanh toán. Vui lòng hoàn tất chuyển khoản theo mã QR.'
      });
    }

    // 4. Đơn hàng ĐÃ THANH TOÁN (PAID hoặc DELIVERED) -> Giao link sản phẩm cho khách
    const deliveryLink = order.payment_delivery_link || order.product_delivery_link || '';
    const deliveryContent = order.delivery_content || (deliveryLink ? `Link nhận sản phẩm của bạn: ${deliveryLink}` : 'Đang cập nhật nội dung bàn giao từ hệ thống. Quý khách vui lòng liên hệ Admin ZENIX LAB.');

    return res.status(200).json({
      success: true,
      can_claim: true,
      status: order.status,
      delivery: {
        payment_id: order.payment_id,
        product_name: order.product_name || order.product,
        package: order.package || 'Vĩnh viễn',
        amount: order.amount,
        delivery_content: deliveryContent,
        delivery_link: deliveryLink
      }
    });

  } catch (err) {
    console.error('Lỗi tra cứu đơn hàng:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
