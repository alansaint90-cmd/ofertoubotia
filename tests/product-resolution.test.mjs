import assert from "node:assert/strict";
import { test } from "node:test";
import { itemFromProductUrl, manualReviewSchema, safeProductImage } from "../src/lib/integrations/product-review.ts";
import { allowedProductUrl, publicProductAddress, resolveProductLink } from "../src/lib/integrations/resolve-product-link.ts";

test("não confunde catálogo ou vitrine com anúncio", () => {
  assert.equal(itemFromProductUrl("https://www.mercadolivre.com.br/p/MLB123456789"), undefined);
  assert.equal(itemFromProductUrl("https://www.mercadolivre.com.br/social/MLB123456789"), undefined);
  assert.equal(itemFromProductUrl("https://www.mercadolivre.com.br/p/MLB123456789?wid=MLB987654321"), "MLB987654321");
  assert.equal(itemFromProductUrl("https://produto.mercadolivre.com.br/MLB-987654321-nome"), "MLB987654321");
});
test("resolve redirecionamento relativo e mantém domínio permitido", async () => {
  let count = 0;
  const id = await resolveProductLink("https://meli.la/teste", itemFromProductUrl, async () => {
    count++;
    return { status: 302, location: "https://produto.mercadolivre.com.br/MLB-987654321-nome", html: "" };
  });
  assert.equal(id, "MLB987654321"); assert.equal(count, 1);
  await assert.rejects(() => resolveProductLink("https://meli.la/teste", itemFromProductUrl, async () => ({ status: 302, location: "https://127.0.0.1/private", html: "" })), /unsupported_link/);
  await assert.rejects(() => resolveProductLink("https://meli.la/teste", itemFromProductUrl, async () => ({ status: 302, location: "/teste", html: "" })), /redirect_loop/);
});
test("vitrine, bloqueio e página sem identificação pedem preenchimento manual", async () => {
  await assert.rejects(() => resolveProductLink("https://www.mercadolivre.com.br/social/autor", itemFromProductUrl, async () => { throw new Error("não deveria buscar"); }), /showcase_link/);
  await assert.rejects(() => resolveProductLink("https://meli.la/teste", itemFromProductUrl, async () => ({ status: 403, html: "" })), /link_unavailable/);
  await assert.rejects(() => resolveProductLink("https://meli.la/teste", itemFromProductUrl, async () => ({ status: 200, html: '<a href="https://produto.mercadolivre.com.br/MLB-987654321-recomendado">Outro produto</a>' })), /identification_pending/);
});
test("bloqueia rede privada, credenciais e URLs arbitrárias", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "172.16.0.1"]) assert.equal(publicProductAddress(ip), false);
  for (const url of ["http://meli.la/a", "https://evil.example/a", "https://user:pass@meli.la/a", "https://meli.la:444/a"]) assert.throws(() => allowedProductUrl(url));
});
test("revisão exige dados completos, imagem oficial e confirmação", () => {
  const details = { title: "Produto", price: 42, imageUrl: "https://http2.mlstatic.com/test.jpg", confirmed: true };
  assert.equal(manualReviewSchema.safeParse(details).success, true);
  assert.equal(manualReviewSchema.safeParse({ ...details, confirmed: false }).success, false);
  assert.equal(manualReviewSchema.safeParse({ ...details, price: -1 }).success, false);
  assert.equal(safeProductImage("https://evil.example/photo.jpg"), false);
});
