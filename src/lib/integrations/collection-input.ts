import { z } from "zod";

export function identifyItem(link: string): string | undefined {
  try { return new URL(link).pathname.match(/(?:^|\/)MLB-?(\d{6,20})(?=[^0-9]|$)/i)?.[1]?.replace(/^(.*)$/, "MLB$1"); } catch { return undefined; }
}
export const collectionEntry = z.object({
  affiliateUrl: z.string().trim().max(2000).url().refine(value => {
    let url: URL;
    try { url = new URL(value); } catch { return false; }
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "meli.la" || url.hostname === "mercadolivre.com.br" || url.hostname.endsWith(".mercadolivre.com.br"));
  }, "Use um link HTTPS do Mercado Livre ou meli.la."),
  itemId: z.string().trim().max(100).toUpperCase().transform(value => value.replace(/^MLB-/, "MLB")).default(""),
  title: z.string().trim().max(200).default(""),
}).transform(data => ({ ...data, referenceCode: data.itemId && !/^MLB\d{6,20}$/.test(data.itemId) ? data.itemId : "", itemId: /^MLB\d{6,20}$/.test(data.itemId) ? data.itemId : identifyItem(data.affiliateUrl) ?? null }))
  .superRefine((data, ctx) => {
    if (data.referenceCode && !/^[A-Z0-9-]{1,100}$/.test(data.referenceCode)) ctx.addIssue({ code: "custom", path: ["itemId"], message: "Use letras, números e hífen no código de referência." });
    const inferred = identifyItem(data.affiliateUrl);
    if (inferred && inferred !== data.itemId) ctx.addIssue({ code: "custom", path: ["itemId"], message: "O ID informado difere do anúncio no link." });
  });

export function parseCollectionLines(text: string) {
  return text.split(/\r?\n/).map((line, index) => ({ line, index })).filter(row => row.line.trim()).map(row => {
    const [affiliateUrl, itemId = "", title = "", ...extra] = row.line.split(";");
    const parsed = collectionEntry.safeParse({ affiliateUrl, itemId, title });
    return { line: row.index + 1, data: parsed.success && !extra.length ? parsed.data : null, error: extra.length ? "Use apenas link;ID;nome." : parsed.success ? null : parsed.error.issues.map(issue => issue.message).join(" ") };
  });
}
