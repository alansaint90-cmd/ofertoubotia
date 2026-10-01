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
  // Include payment conditions, not only the numeric promotional price.
  const description = text(root.querySelector(".poly-component__price") || root.querySelector(".ui-pdp-price"));
  const clean = new URL(productUrl);
  const wid = clean.searchParams.get("wid") || new URLSearchParams(clean.hash.slice(1)).get("wid");
  clean.search = ""; clean.hash = "";
  if (wid && /^MLB\d{6,20}$/.test(wid)) clean.searchParams.set("wid", wid);
  productUrl = clean.href;
  return { version: 1, productUrl, title, price, imageUrl, description, capturedAt: new Date().toISOString() };
}
