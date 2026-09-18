import { json, options } from "./_cors.js";

export const runtime = "nodejs";

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return options(request);
  }

  if (request.method !== "GET") {
    return json(
      request,
      { ok: false, error: "METHOD_NOT_ALLOWED" },
      405
    );
  }

  try {
    if (!process.env.DATABASE_URL) {
      return json(
        request,
        {
          ok: false,
          service: "autobank-zenix",
          database: "error",
          error: "DATABASE_URL_NOT_CONFIGURED"
        },
        500
      );
    }

    const { neon } = await import("@neondatabase/serverless");

    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT NOW() AS now
    `;

    return json(request, {
      ok: true,
      service: "autobank-zenix",
      database: "connected",
      now: rows[0].now
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);

    return json(
      request,
      {
        ok: false,
        service: "autobank-zenix",
        database: "error",
        error: error?.message || "UNKNOWN_ERROR"
      },
      500
    );
  }
}
