export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "autobank-zenix",
    message: "Vercel Function is running"
  });
}
