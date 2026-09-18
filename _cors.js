const DEFAULT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export function setCors(request, headers = {}) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();

  if (!allowed.length) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  headers["Access-Control-Max-Age"] = "86400";
  return headers;
}

export function json(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: setCors(request, { ...DEFAULT_HEADERS, ...extraHeaders })
  });
}

export function options(request) {
  return new Response(null, {
    status: 204,
    headers: setCors(request, {
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    })
  });
}
