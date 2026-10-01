import { z } from "zod";
import { collectionEntry } from "./collection-input";
import { itemFromProductUrl, safeProductImage } from "./product-review";

export function productIdentity(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["www.mercadolivre.com.br", "mercadolivre.com.br", "produto.mercadolivre.com.br"].includes(url.hostname)) throw new Error("invalid_product_url");
  const catalogId = url.pathname.match(/\/p\/(MLB\d{6,20})(?:\/|$)/)?.[1] ?? null;
  const itemId = itemFromProductUrl(value) ?? null;
  if (!catalogId && !itemId) throw new Error("invalid_product_url");
  return { catalogId, itemId };
}
export const browserImportSchema = z.object({
  version: z.literal(1),
  affiliateUrl: z.string().max(2000).refine(value => collectionEntry.safeParse({ affiliateUrl: value }).success),
  productUrl: z.string().max(2000).refine(value => { try { productIdentity(value); return true; } catch { return false; } }),
  title: z.string().trim().min(1).max(200),
  price: z.number().positive().max(10000000),
  imageUrl: z.string().max(2000).refine(safeProductImage),
  description: z.string().trim().max(1500),
  capturedAt: z.iso.datetime().refine(value => Date.parse(value) <= Date.now() + 300000 && Date.parse(value) >= Date.now() - 86400000, "Captura expirada. Capture novamente no navegador."),
});
export type BrowserImport = z.infer<typeof browserImportSchema>;
