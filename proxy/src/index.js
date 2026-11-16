/**
 * CORS proxy for the xAI chat, responses, and files APIs.
 * The browser keeps the API key and sends it as Authorization; this worker
 * only forwards the request so GitHub Pages is not blocked by a failed preflight.
 */
const ALLOWED_ORIGINS = new Set([
  "https://cubecnelson.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

const ALLOWED_PATH = /^\/(v1\/)?(chat\/completions|responses|files)\/?$/;

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  let hostname = "";
  try { hostname = new URL(origin || "http://invalid").hostname; } catch {}
  const allow =
    ALLOWED_ORIGINS.has(origin) ||
    /\.pages\.dev$/.test(hostname) ||
    /\.workers\.dev$/.test(hostname)
      ? origin
      : "https://cubecnelson.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function withCors(request, extra = {}) {
  return { ...corsHeaders(request), ...extra };
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATH.test(url.pathname)) {
      return new Response("Not found", { status: 404, headers: cors });
    }

    const auth = request.headers.get("Authorization") || "";
    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: withCors(request, { "Content-Type": "application/json" })
      });
    }

    const path = url.pathname.startsWith("/v1/") ? url.pathname : `/v1${url.pathname}`;
    const target = `https://api.x.ai${path}${url.search}`;
    const headers = { Authorization: auth };
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers["Content-Type"] = contentType;
    const accept = request.headers.get("Accept");
    if (accept) headers["Accept"] = accept;

    let upstream;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers,
        body: request.body
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Upstream request failed" }), {
        status: 502,
        headers: withCors(request, { "Content-Type": "application/json" })
      });
    }

    const outHeaders = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(cors)) outHeaders.set(key, value);
    outHeaders.set("Cache-Control", "no-cache");
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  }
};
