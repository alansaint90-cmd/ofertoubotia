export type Product = { id: string; name: string; category: string; price: number; oldPrice: number; rating: number; sold: string; commission: number; icon: string; color: string; store: string };
export type Group = { id: string; name: string; category: string; members: number; active: boolean };
export type Offer = { id: string; productId: string; headline: string; body: string; groupIds: string[]; status: "rascunho" | "agendado" | "enviado"; scheduledAt?: string; createdAt: string };

export const products: Product[] = [
  { id: "air-fryer", name: "Air Fryer Mondial Family 4L", category: "Casa", price: 279.90, oldPrice: 499.90, rating: 4.9, sold: "12 mil", commission: 8, icon: "🍟", color: "peach", store: "Loja Mondial" },
  { id: "smartwatch", name: "Smartwatch Ultra Fit Pro", category: "Tecnologia", price: 189.90, oldPrice: 329.90, rating: 4.8, sold: "8,4 mil", commission: 10, icon: "⌚", color: "lavender", store: "Tech Store" },
  { id: "fone", name: "Fone Bluetooth TWS Sem Fio", category: "Tecnologia", price: 79.90, oldPrice: 149.90, rating: 4.7, sold: "23 mil", commission: 9, icon: "🎧", color: "mint", store: "Audio Brasil" },
  { id: "aspirador", name: "Aspirador de Pó Vertical 2 em 1", category: "Casa", price: 219.90, oldPrice: 359.90, rating: 4.8, sold: "5,2 mil", commission: 7, icon: "🧹", color: "sky", store: "Casa Prática" },
  { id: "ferramentas", name: "Kit de Ferramentas 129 Peças", category: "Casa", price: 149.90, oldPrice: 249.90, rating: 4.9, sold: "9,1 mil", commission: 6, icon: "🧰", color: "butter", store: "Oficina Pro" },
];
export const initialGroups: Group[] = [
  { id: "casa", name: "Achadinhos Casa", category: "Casa", members: 256, active: true },
  { id: "tech", name: "Promo Tech", category: "Tecnologia", members: 198, active: true },
  { id: "gerais", name: "Ofertas Gerais", category: "Geral", members: 341, active: true },
  { id: "beleza", name: "Achadinhos Beleza", category: "Beleza", members: 164, active: false },
];
export const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export const discount = (product: Product) => Math.round((1 - product.price / product.oldPrice) * 100);
export function makeCopy(product: Product, style: string, link: string) {
  const open = style === "Minimalista" ? product.name : style === "Informativa" ? `Confira: ${product.name}` : style === "Urgência" ? `🔥 Oferta para aproveitar: ${product.name}` : `✨ Achadinho do dia: ${product.name}`;
  return `${open}\n\nDe ${money(product.oldPrice)} por ${money(product.price)}\n🏷️ ${discount(product)}% de desconto\n⭐ ${product.rating} · +${product.sold} vendidos\n\n🛒 Confira aqui: ${link || "[adicione seu link de afiliado]"}`;
}
