import { neon } from '@neondatabase/serverless';

function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) return null;
  return neon(dbUrl);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shin_18122010';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password, *');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authPass = req.headers['x-admin-password'] || (req.query && req.query.admin_password) || (req.body && req.body.admin_password);
  if (authPass && authPass.toLowerCase() !== ADMIN_PASSWORD.toLowerCase()) {
    return res.status(401).json({ success: false, error: 'Mật khẩu bảo mật không hợp lệ.' });
  }

  const sql = getSql();
  if (!sql) {
    return res.status(500).json({ success: false, error: 'Chưa cấu hình DATABASE_URL trên Vercel.' });
  }

  if (req.method === 'GET') {
    const { status } = req.query || {};
    try {
      try {
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_link TEXT;`;
        await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS delivery_content TEXT;`;
      } catch (e) {}

      let paymentRows = [];
      let orderRows = [];

      // 1. Quét toàn bộ giao dịch từ bảng payments
      try {
        paymentRows = await sql`
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
          LIMIT 200
        `;
      } catch (errP) {
        console.warn('Query payments warning:', errP.message);
      }

      // 2. Quét toàn bộ giao dịch từ bảng orders (nếu có dữ liệu cũ)
      try {
        orderRows = await sql`
          SELECT 
            o.payment_id,
            o.product_id,
            o.amount,
            o.status,
            o.created_at,
            o.delivered_at AS updated_at,
            COALESCE(o.delivery_link, prod.delivery_link, '') AS delivery_link,
            COALESCE(o.delivery_content, '') AS delivery_content,
            COALESCE(prod.name, o.product_id) AS product_name,
            COALESCE(prod.category, 'Ứng dụng') AS category,
            COALESCE(prod.package, 'Gói mặc định') AS package,
            prod.image_url
          FROM orders o
          LEFT JOIN products prod ON o.product_id = prod.id
          ORDER BY o.created_at DESC
          LIMIT 200
        `;
      } catch (errO) {
        console.warn('Query orders warning:', errO.message);
      }

      // 3. Hợp nhất và loại bỏ trùng lặp theo payment_id
      const map = new Map();
      for (const p of paymentRows) {
        if (p.payment_id) map.set(p.payment_id, p);
      }
      for (const o of orderRows) {
        if (o.payment_id && !map.has(o.payment_id)) {
          map.set(o.payment_id, o);
        }
      }

      let allOrders = Array.from(map.values());
      allOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      // Lọc theo trạng thái nếu người dùng chọn bộ lọc
      let filteredOrders = allOrders;
      if (status && status !== 'ALL') {
        filteredOrders = allOrders.filter(o => {
          const s = (o.status || '').toUpperCase();
          const target = status.toUpperCase();
          if (target === 'PAID') return s === 'PAID' || s === 'COMPLETED' || s === 'SUCCESS';
          return s === target;
        });
      }

      const stats = {
        total_orders: allOrders.length,
        total_revenue: allOrders
          .filter(o => ['PAID', 'DELIVERED', 'COMPLETED', 'SUCCESS'].includes((o.status || '').toUpperCase()))
          .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0),
        pending_count: allOrders.filter(o => (o.status || '').toUpperCase() === 'PENDING').length,
        paid_count: allOrders.filter(o => ['PAID', 'COMPLETED', 'SUCCESS'].includes((o.status || '').toUpperCase())).length,
        delivered_count: allOrders.filter(o => (o.status || '').toUpperCase() === 'DELIVERED').length
      };

      return res.status(200).json({
        success: true,
        stats,
        orders: filteredOrders
      });
    } catch (err) {
      console.error('Fatal fetch orders error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

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

      try {
        await sql`
          UPDATE payments
          SET 
            delivery_content = COALESCE(${delivery_content}, delivery_content),
            delivery_link = COALESCE(${delivery_link}, delivery_link),
            status = ${nextStatus},
            updated_at = NOW()
          WHERE payment_id = ${payment_id}
        `;
      } catch (errP) {}

      try {
        await sql`
          UPDATE orders
          SET 
            delivery_content = COALESCE(${delivery_content}, delivery_content),
            delivery_link = COALESCE(${delivery_link}, delivery_link),
            status = ${nextStatus},
            delivered_at = CURRENT_TIMESTAMP
          WHERE payment_id = ${payment_id}
        `;
      } catch (errO) {}

      return res.status(200).json({
        success: true,
        message: `Đã cập nhật bàn giao thành công cho đơn [${payment_id}]. Trạng thái: ${nextStatus}.`
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
