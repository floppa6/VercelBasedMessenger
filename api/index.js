// ─────────────────────────────────────────────────────────────────────────────
//  Edge Proxy  ·  Vercel Edge Runtime
//  Forwards every request to RESOLVER_DOMAIN, sanitising hop-by-hop headers
//  and collapsing x-forwarded-for / x-real-ip into a single clean header.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { runtime: "edge" };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Upstream origin – trailing slash stripped so path concat is always clean. */
const UPSTREAM_ORIGIN = (process.env.RESOLVER_DOMAIN ?? "").replace(/\/$/, "");

/**
 * Headers that must not be forwarded to the upstream.
 * Defined by RFC 7230 §6.1 (hop-by-hop) plus Vercel-specific headers that
 * would confuse downstream servers.
 */
const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reconstruct the full target URL by replacing the scheme+host portion of the
 * incoming request URL with the configured upstream origin.
 *
 * `req.url` inside an Edge function looks like:
 *   https://<deployment-host>/some/path?query=1
 *                              ↑ pathStart
 */
function buildTargetUrl(requestUrl) {
  const pathStart = requestUrl.indexOf("/", 8); // skip "https://"
  return pathStart === -1
    ? UPSTREAM_ORIGIN + "/"
    : UPSTREAM_ORIGIN + requestUrl.slice(pathStart);
}

/**
 * Build a sanitised header map to forward upstream.
 *
 * Rules:
 *  1. Drop all hop-by-hop headers.
 *  2. Drop all Vercel-internal headers (`x-vercel-*`).
 *  3. Collapse `x-real-ip` / `x-forwarded-for` → single `x-forwarded-for`.
 *     `x-real-ip` wins over `x-forwarded-for` when both are present.
 *
 * @param {Headers} incoming  – headers from the client request
 * @returns {{ headers: Headers, clientIp: string | null }}
 */
function sanitiseHeaders(incoming) {
  const outgoing = new Headers();
  let clientIp = null;

  for (const [key, value] of incoming) {
    if (HOP_BY_HOP_HEADERS.has(key)) continue;
    if (key.startsWith("x-vercel-")) continue;

    if (key === "x-real-ip") {
      clientIp = value; // x-real-ip is authoritative
      continue;
    }

    if (key === "x-forwarded-for") {
      clientIp ??= value; // only use x-forwarded-for as fallback
      continue;
    }

    outgoing.set(key, value);
  }

  if (clientIp !== null) {
    outgoing.set("x-forwarded-for", clientIp);
  }

  return outgoing;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req) {
  // Guard: upstream must be configured via environment variable.
  if (!UPSTREAM_ORIGIN) {
    return new Response("Proxy misconfigured: RESOLVER_DOMAIN is not set.", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }

  try {
    const targetUrl = buildTargetUrl(req.url);
    const forwardHeaders = sanitiseHeaders(req.headers);

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return upstreamResponse;
  } catch (error) {
    console.error("[edge-proxy] upstream fetch failed:", error);
    return new Response("Bad Gateway", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
}