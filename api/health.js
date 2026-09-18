import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "METHOD_NOT_ALLOWED"
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        ok: false,
        error: "DATABASE_URL_NOT_CONFIGURED"
      });
    }

    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      SELECT NOW() AS now
    `;

    return res.status(200).json({
      ok: true,
      service: "autobank-zenix",
      database: "connected",
      now: result[0].now
    });
  } catch (error) {
    console.error("DATABASE TEST ERROR:", error);

    return res.status(500).json({
      ok: false,
      database: "error",
      error: error?.message || "UNKNOWN_DATABASE_ERROR"
    });
  }
}
