import { z } from "zod";

export function safeProductImage(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "http2.mlstatic.com" || url.hostname.endsWith(".mlstatic.com")); } catch { return false; }
}
export const manualReviewSchema = z.object({
  title: z.string().trim().min(1).max(200),
  price: z.number().positive().max(10000000),
  imageUrl: z.string().max(2000).refine(safeProductImage, "Use o endereço HTTPS da foto do produto no Mercado Livre (mlstatic.com)."),
  description: z.string().trim().max(1500).default(""),
  confirmed: z.literal(true),
});
export type ProductDetails = { title: string; price: number | null; imageUrl: string; description: string; source: "api" | "manual"; reviewedAt: string | null; checkedAt: string; status?: string };

export function itemFromProductUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!["www.mercadolivre.com.br", "produto.mercadolivre.com.br", "mercadolivre.com.br"].includes(url.hostname)) return;
    for (const params of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
      const id = params.get("item_id") ?? params.get("wid");
      if (id && /^MLB\d{6,20}$/.test(id)) return id;
    }
    // A /p/MLB identifier is a catalog product, not a seller's listing.
    if (/\/p\/MLB/i.test(url.pathname) || /^\/social\//i.test(url.pathname)) return;
    const match = url.pathname.match(/(?:^|\/)MLB-?(\d{6,20})(?=[^0-9]|$)/i);
    return match ? `MLB${match[1]}` : undefined;
  } catch { return; }
}
