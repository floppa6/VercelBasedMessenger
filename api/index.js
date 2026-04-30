export const config = { runtime: "edge" };

const GOH_SAG = (process.env.RESOLVER_DOMAIN || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
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

export default async function handler(req) {
  if (!GOH_SAG) {
    return new Response("ridi daus", { status: 500 });
  }

    try {
    const url = new URL(req.url);
    // This removes the "/api" part from the start of the path
    const cleanPath = url.pathname.replace(/^\/api/, "");
    const targetUrl = GOH_SAG + cleanPath + url.search;

    const out = new Headers();
    let clientIp = null;
    for (const [k, v] of req.headers) {
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      out.set(k, v);
    }
    if (clientIp) out.set("x-forwarded-for", clientIp);

    const method = req.method;
    const badanDare = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: out,
      body: badanDare ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    console.error("eshtebahe goh:", err);
    return new Response("Bad kir: ridi", { status: 502 });
  }
}
