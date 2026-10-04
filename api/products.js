import { getDb, ADMIN_PASSWORD } from './db.js';

// 13 sản phẩm dự phòng chuẩn của ZENIX LAB nếu DB chưa nạp xong
const FALLBACK_PRODUCTS = [
  { id: 'locketgold15s', name: 'Locket Gold 15s', category: 'Ứng dụng', amount: 40000, old_amount: 70000, package: 'Vĩnh viễn', description: 'Locket full chức năng, bảo hành đầy đủ trọn đời.', image_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkwXtsvWEAwWrpOcUI4FHS4ouCrpCZhPHHLe8icVeDQBmfD-a-32VdGjY&s=10', rating: '★ 4.9 (1.1k)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'canvapro', name: 'Canva Pro', category: 'Phần mềm', amount: 40000, old_amount: 100000, package: '1 Year', description: 'Canva Pro đầy đủ tính năng thiết kế cao cấp không giới hạn.', image_url: 'https://static.freepnglogo.com/images/all_img/1691829322canva-app-logo-png.png', rating: '★ 4.9 (982)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'gemini5tb', name: 'Genimi Pro + 5TB Google One', category: 'Ứng dụng', amount: 48888, old_amount: 273000, package: '18 Months', description: 'Gói 5TB lưu trữ dung lượng lớn và AI Gemini Pro nâng cao.', image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg', rating: '★ 5.0 (132)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'netflixuhd', name: 'Netflix UHD Chính chủ', category: 'Sản Phẩm', amount: 35000, old_amount: 80000, package: '1 Month', description: 'Kích hoạt gói Netflix Ultra HD tài khoản riêng, bảo hành 1 đổi 1.', image_url: 'https://assets.nflxext.com/ffe/siteui/common/icons/monogram/netflix-monogram.png', rating: '★ 5.0 (102)', stock_status: 'Luôn sẵn sàng', badge: 'TỰ ĐỘNG' },
  { id: 'damefacebook', name: 'Dame tài khoản Facebook', category: 'Dịch vụ', amount: 150000, old_amount: 500000, package: '1 acc', description: 'Làm Die tài khoản facebook người khác, xử lý nhanh chóng.', image_url: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png', rating: '★ 5.0 (422)', stock_status: 'Luôn sẵn sàng', badge: 'TỰ ĐỘNG' },
  { id: 'dameinstagram', name: 'Dame tài khoản Instagram', category: 'Dịch vụ', amount: 75000, old_amount: 150000, package: '1 acc', description: 'Làm Die tài khoản instagram người khác an toàn bảo mật.', image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png', rating: '★ 5.0 (762)', stock_status: 'Luôn sẵn sàng', badge: 'TỰ ĐỘNG' },
  { id: 'dametiktok', name: 'Dame tài khoản Tiktok', category: 'Dịch vụ', amount: 150000, old_amount: 500000, package: '1 acc', description: 'Làm Die tài khoản tiktok vi phạm theo yêu cầu.', image_url: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png', rating: '★ 5.0 (198)', stock_status: 'Luôn sẵn sàng', badge: 'TỰ ĐỘNG' },
  { id: 'tutbaogiamgiashopee', name: 'Tut Bào Giảm giá Shopee', category: 'Tut Trick', amount: 50000, old_amount: 100000, package: '1 tut', description: 'Sử dụng mã giảm giá 100k nhiều lần, hướng dẫn chi tiết.', image_url: 'https://cdn.iconscout.com/icon/free/png-256/free-shopee-logo-icon-download-in-svg-png-gif-file-formats--shopping-social-media-pack-logos-icons-3521696.png', rating: '★ 4.9 (318)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'tutruaip', name: 'Tut Rửa I.P', category: 'Tut Trick', amount: 35000, old_amount: 60000, package: '1 tut', description: 'Rửa I.P bẩn, hạn chế checkpoint, vượt mọi cơ chế quét.', image_url: 'https://cdn-icons-png.flaticon.com/512/2885/2885417.png', rating: '★ 4.4 (38)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'tutmanguonblackmmo', name: 'Tut Mã Nguồn - Black MMO', category: 'Tut Trick', amount: 2000000, old_amount: 5000000, package: '1 tut', description: 'Kiếm 150k/1 ngày quy trình chuyên nghiệp khép kín.', image_url: 'https://cdn-icons-png.flaticon.com/512/2721/2721295.png', rating: '★ 5.0 (1)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'tooldamefacebook', name: 'Tool Dame Facebook', category: 'Tools', amount: 100000, old_amount: 300000, package: '1 tool', description: 'Tool Dame Facebook full chức năng tự động, cập nhật trọn đời.', image_url: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png', rating: '★ 5.0 (94)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'unlockfacebook282', name: 'Unlock acc Facebook 180 ngày', category: 'Dịch vụ', amount: 150000, old_amount: 300000, package: '1 acc', description: 'Mở khóa acc facebook dưới dạng 282 (đình chỉ, vô hiệu hóa,...).', image_url: 'https://cdn-icons-png.flaticon.com/512/3536/3536394.png', rating: '★ 5.0 (94)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' },
  { id: 'mokhoagioihanai', 'name': 'Tut ChatGPT', category: 'Tut Trick', amount: 125000, old_amount: 275000, package: '1 tut', description: 'Mở khóa giới hạn AI (upload ảnh, tệp, thời gian sử dụng,...).', image_url: 'https://cdn-icons-png.flaticon.com/512/12222/12222560.png', rating: '★ 5.0 (48)', stock_status: 'Còn hàng', badge: 'TỰ ĐỘNG' }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  const sql = getDb();

  // GET: Lấy danh sách sản phẩm (Tự động fallback nếu DB chưa nhận biến)
  if (req.method === 'GET') {
    if (!sql) {
      return res.status(200).json({ success: true, source: 'fallback', products: FALLBACK_PRODUCTS });
    }
    try {
      const rows = await sql`SELECT * FROM products WHERE status = 'active' ORDER BY is_featured DESC, created_at ASC`;
      if (rows && rows.length > 0) {
        return res.status(200).json({ success: true, source: 'neon_postgres', products: rows });
      }
      return res.status(200).json({ success: true, source: 'fallback', products: FALLBACK_PRODUCTS });
    } catch (err) {
      console.warn('Lỗi đọc DB, chuyển sang danh sách dự phòng:', err.message);
      return res.status(200).json({ success: true, source: 'fallback', products: FALLBACK_PRODUCTS, db_error: err.message });
    }
  }

  // Admin xác thực mật khẩu
  const authPass = req.headers['x-admin-password'] || (req.body && req.body.admin_password);
  if (authPass !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Mật khẩu bảo mật không hợp lệ.' });
  }

  // POST: Admin thêm mới hoặc sửa giá sản phẩm
  if (req.method === 'POST') {
    const { id, name, category, amount, old_amount, package: pkg, description, image_url, badge, stock_status, is_featured } = req.body || {};
    if (!id || !name || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Thiếu ID, Tên hoặc Giá sản phẩm.' });
    }

    if (!sql) {
      return res.status(500).json({ success: false, error: 'Chưa kết nối được Neon Database. Hãy Redeploy trên Vercel.' });
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
