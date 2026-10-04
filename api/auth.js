import { getDb, ADMIN_PASSWORD } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { password } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!password) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp mật khẩu quản trị.' });
  }

  const sql = getDb();

  if (password === ADMIN_PASSWORD) {
    if (sql) {
      try {
        await sql`
          INSERT INTO security_events (threat_level, event_type, source_ip, details, status)
          VALUES ('INFO', 'ADMIN_LOGIN_SUCCESS', ${clientIp}, 'Đăng nhập trang quản trị thành công.', 'RESOLVED')
        `;
      } catch (e) {}
    }
    return res.status(200).json({
      success: true,
      message: 'Xác thực thành công.',
      token: Buffer.from(`${password}:${Date.now()}`).toString('base64')
    });
  } else {
    if (sql) {
      try {
        await sql`
          INSERT INTO security_events (threat_level, event_type, source_ip, details, status)
          VALUES ('WARNING', 'BRUTE_FORCE_PROBE', ${clientIp}, 'Phát hiện nhập sai mật khẩu admin.', 'BLOCKED')
        `;
      } catch (e) {}
    }
    return res.status(401).json({ success: false, error: 'Mật khẩu chỉ huy không chính xác.' });
  }
}
