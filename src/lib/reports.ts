import type { Group, Offer, Product } from "./demo";

export type ReportRange = "7d" | "30d" | "all";

export function buildDemoReport(
  offers: Offer[],
  groups: Group[],
  products: Product[],
  range: ReportRange,
  now = new Date(),
) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : null;
  const start = days === null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const validOffers = offers.filter(offer => {
    const created = new Date(offer.createdAt);
    return !Number.isNaN(created.getTime()) && created <= now && (!start || created >= start);
  });
  const productCounts = new Map<string, number>();
  const groupCounts = new Map<string, number>();
  for (const offer of validOffers) {
    productCounts.set(offer.productId, (productCounts.get(offer.productId) ?? 0) + 1);
    for (const groupId of new Set(offer.groupIds)) {
      groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
    }
  }
  const productRanking = [...productCounts].map(([id, count]) => ({
    id, name: products.find(product => product.id === id)?.name ?? "Produto indisponível", count,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const groupRanking = [...groupCounts].map(([id, count]) => ({
    id, name: groups.find(group => group.id === id)?.name ?? "Grupo indisponível", count,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const daily = days === null ? [] : Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 + index);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const count = validOffers.filter(offer => {
      const created = new Date(offer.createdAt);
      return `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}` === key;
    }).length;
    return { label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), count };
  });
  return {
    total: validOffers.length,
    drafts: validOffers.filter(offer => offer.status === "rascunho").length,
    scheduled: validOffers.filter(offer => offer.status === "agendado").length,
    activeGroups: groups.filter(group => group.active).length,
    productRanking,
    groupRanking,
    daily,
  };
}
