import { sql } from "./_db.js";
import { json, options } from "./_cors.js";

export const runtime = "nodejs";

export default async function handler(request) {
  if (request.method === "OPTIONS") return options(request);
  if (request.method !== "GET") {
    return json(request, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const rows = await sql`SELECT NOW() AS now`;
    return json(request, {
      ok: true,
      service: "autobank-zenix",
      database: "connected",
      now: rows[0].now
    });
  } catch (error) {
    console.error("health error", error);
    return json(request, {
      ok: false,
      service: "autobank-zenix",
      database: "error"
    }, 500);
  }
}
