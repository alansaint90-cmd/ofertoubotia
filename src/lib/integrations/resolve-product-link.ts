import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { BlockList } from "node:net";

const blocked = new BlockList();
for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["100.64.0.0", 10], ["192.0.0.0", 24], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(ip, bits);
export function allowedProductUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["meli.la", "mercadolivre.com.br", "www.mercadolivre.com.br", "produto.mercadolivre.com.br"].includes(url.hostname)) throw new Error("unsupported_link");
  return url;
}
export function publicProductAddress(ip: string) { return !blocked.check(ip, "ipv4"); }

async function readPage(url: URL): Promise<{ status: number; location?: string; html: string }> {
  // Pin the validated IPv4 address to this connection; never send OAuth headers to links.
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some(row => !publicProductAddress(row.address))) throw new Error("unsupported_link");
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", agent: false, family: 4, lookup: (_hostname, _options, callback) => callback(null, addresses[0].address, 4), headers: { Accept: "text/html", "Accept-Encoding": "identity" }, signal: AbortSignal.timeout(5000) }, response => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) { response.resume(); resolve({ status, location: response.headers.location, html: "" }); return; }
      if (status !== 200 || !response.headers["content-type"]?.includes("text/html")) { response.resume(); resolve({ status, html: "" }); return; }
      let size = 0; const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 524288) response.destroy(new Error("page_too_large")); else chunks.push(chunk); });
      response.on("error", reject);
      response.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject); req.end();
  });
}

export async function resolveProductLink(link: string, extract: (url: string) => string | undefined, read = readPage) {
  let url = allowedProductUrl(link);
  const visited = new Set<string>();
  for (let hop = 0; hop < 5; hop++) {
    if (visited.has(url.href)) throw new Error("redirect_loop");
    visited.add(url.href);
    const id = extract(url.href);
    if (id) return id;
    if (url.pathname.startsWith("/social/")) throw new Error("showcase_link");
    const response = await read(url);
    if (response.status >= 300 && response.status < 400 && response.location) { url = allowedProductUrl(new URL(response.location, url).href); continue; }
    if (response.status !== 200) throw new Error("link_unavailable");
    // Only canonical product identity; never guess from recommended products in the page.
    const tag = response.html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
    const href = tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) {
      const canonical = allowedProductUrl(new URL(href.replace(/&amp;/g, "&"), url).href);
      const canonicalId = extract(canonical.href);
      if (canonicalId) return canonicalId;
    }
    throw new Error("identification_pending");
  }
  throw new Error("redirect_limit");
}
