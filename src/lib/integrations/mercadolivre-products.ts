import { z } from "zod";

export const itemIdSchema = z.string().regex(/^MLB\d{6,20}$/);
export const productSchema = z.object({
  id: itemIdSchema, title: z.string().min(1), price: z.number().nonnegative().nullable(),
  currency_id: z.string().regex(/^[A-Z]{3}$/), status: z.string(), permalink: z.string().url(),
}).transform(item => ({ id: item.id, title: item.title, price: item.price, currency: item.currency_id, status: item.status,
  url: /^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//i.test(item.permalink) ? item.permalink : null }));
export type RealProduct = z.output<typeof productSchema>;

export async function mlGet(path: string, token: string): Promise<unknown> {
  const response = await fetch(`https://api.mercadolibre.com${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(response.status === 401 ? "token_rejected" : response.status === 403 ? "permission_denied" : response.status === 404 ? "not_found" : response.status === 429 ? "rate_limited" : "provider_unavailable");
  return response.json();
}

export async function queryRealProducts(token: string, userId: string, itemId?: string, offset = 0) {
  if (itemId) return { products: [productSchema.parse(await mlGet(`/items/${itemIdSchema.parse(itemId)}`, token))], nextOffset: null };
  if (!/^\d+$/.test(userId)) throw new Error("reconnect_required");
  const list = z.object({ results: z.array(itemIdSchema).max(10), paging: z.object({ total: z.number().int().nonnegative() }) }).parse(await mlGet(`/users/${userId}/items/search?status=active&limit=10&offset=${offset}`, token));
  const products = [];
  for (const id of list.results) products.push(productSchema.parse(await mlGet(`/items/${id}`, token)));
  return { products, nextOffset: list.results.length && offset + list.results.length < Math.min(list.paging.total, 1000) ? offset + list.results.length : null };
}
