// Executed only in the active page after a user click. No cookies or network calls.
export function captureProduct() {
  const here = new URL(location.href);
  if (here.protocol !== "https:" || !["www.mercadolivre.com.br", "mercadolivre.com.br", "produto.mercadolivre.com.br"].includes(here.hostname)) throw new Error("Abra a página do produto no Mercado Livre.");
  const text = node => (node?.innerText ?? node?.textContent)?.replace(/\s+/g, " ").trim() ?? "";
  let root, productUrl, title, image, priceRoot;
  if (here.pathname.startsWith("/social/")) {
    const buttons = [...document.querySelectorAll("a")].filter(a => text(a) === "Ir para produto" && a.getClientRects().length);
    if (buttons.length !== 1) throw new Error("Abra um link com um único produto destacado.");
    root = buttons[0].closest(".poly-card");
    if (!root) throw new Error("Formato do destaque não reconhecido.");
    const anchor = root.querySelector("a.poly-component__title");
    productUrl = anchor?.href;
    title = text(anchor);
    image = root.querySelector("img.poly-component__picture");
    priceRoot = root.querySelector(".poly-price__current .andes-money-amount");
  } else {
    root = document.querySelector(".ui-pdp-container");
    productUrl = location.href;
    title = text(root?.querySelector("h1.ui-pdp-title"));
    image = root?.querySelector("img.ui-pdp-image");
    priceRoot = root?.querySelector(".ui-pdp-price__second-line .andes-money-amount");
  }
  const fraction = text(priceRoot?.querySelector(".andes-money-amount__fraction")).replace(/\./g, "");
  const cents = text(priceRoot?.querySelector(".andes-money-amount__cents")) || "00";
  const currency = text(priceRoot?.querySelector(".andes-money-amount__currency-symbol"));
  const price = Number(`${fraction}.${cents}`);
  const imageUrl = image?.currentSrc || image?.src;
  if (!title || !productUrl || !imageUrl || currency !== "R$" || !/^\d+$/.test(fraction) || !/^\d{2}$/.test(cents) || !(price > 0)) throw new Error("Não consegui capturar foto, título e preço com segurança. Aguarde o carregamento ou abra o anúncio e tente novamente.");
  // Read only the selected product, never prices or badges from recommendations.
  const first = selectors => selectors.map(selector => root.querySelector(selector)).find(Boolean);
  const money = node => {
    const whole = text(node?.querySelector(".andes-money-amount__fraction")).replace(/\./g, "");
    const decimal = text(node?.querySelector(".andes-money-amount__cents")) || "00";
    if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(decimal) || text(node?.querySelector(".andes-money-amount__currency-symbol")) !== "R$") return null;
    return Number(`${whole}.${decimal}`);
  };
  const brl = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // Money amounts use separate DOM nodes for cents. Plain innerText loses the comma.
  const paymentText = node => {
    if (!node?.cloneNode) return text(node);
    const copy = node.cloneNode(true);
    for (const amount of copy.querySelectorAll(".andes-money-amount")) {
      const value = money(amount);
      if (value !== null) amount.replaceWith(document.createTextNode(brl(value)));
    }
    return text(copy);
  };
  const priceBlock = first([".poly-component__price", ".ui-pdp-price"]);
  const oldPrice = money(first([".poly-price__previous", ".ui-pdp-price__original-value", ".ui-pdp-price s.andes-money-amount"]));
  const discount = text(first([".poly-price__current .andes-money-amount__discount", ".ui-pdp-price__second-line .andes-money-amount__discount"]));
  const payment = paymentText(first([".poly-price__installments", ".ui-pdp-price__subtitles"]));
  const badge = text(first([".ui-pdp-promotions-pill-label", ".poly-component__highlight", ".ui-pdp-promotions-pill"]));
  const rating = text(first([".ui-pdp-review__rating", ".poly-reviews__rating"]));
  const sold = text(first([".ui-pdp-subtitle", ".poly-component__subtitle"])).match(/(?:\+\s*)?[\d.,]+\s*(?:mil\s*)?vendidos/i)?.[0];
  const conditions = paymentText(priceBlock);
  const lines = [];
  if (/mais vendido/i.test(badge)) lines.push("🏆 Mais vendido");
  // Keep the percentage displayed by the marketplace: do not recalculate it.
  if (oldPrice && oldPrice > price) {
    lines.push(`De ${brl(oldPrice)} por ${brl(price)}`);
    if (/\d+\s*%/.test(discount)) lines.push(discount);
    if (payment) lines.push(payment);
    // Keep Pix, coupon and other restrictions even when they are outside installments.
    if (/pix|cupom|cartão|cartao|boleto/i.test(conditions) && conditions !== payment) lines.push(conditions);
  } else if (conditions) lines.push(conditions);
  else lines.push(`Por ${brl(price)}`);
  if (rating || sold) lines.push([rating && `⭐ ${rating}`, sold].filter(Boolean).join(" · "));
  const description = lines.join("\n");
  const clean = new URL(productUrl);
  const wid = clean.searchParams.get("wid") || new URLSearchParams(clean.hash.slice(1)).get("wid");
  clean.search = ""; clean.hash = "";
  if (wid && /^MLB\d{6,20}$/.test(wid)) clean.searchParams.set("wid", wid);
  productUrl = clean.href;
  return { version: 1, productUrl, title, price, imageUrl, description, capturedAt: new Date().toISOString() };
}
