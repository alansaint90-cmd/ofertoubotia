import { test } from "node:test";
import assert from "node:assert/strict";
import { collectionEntry, parseCollectionLines } from "../src/lib/integrations/collection-input.ts";
test("extrai anúncio de URL completa e exige ID em link curto", () => {
  assert.equal(collectionEntry.parse({ affiliateUrl: "https://produto.mercadolivre.com.br/MLB-123456789-produto" }).itemId, "MLB123456789");
  assert.equal(collectionEntry.safeParse({ affiliateUrl: "https://meli.la/abc" }).success, false);
  assert.equal(collectionEntry.parse({ affiliateUrl: "https://meli.la/abc", itemId: "mlb-123456789" }).itemId, "MLB123456789");
});
test("recusa destino arbitrário e conflito de ID", () => {
  for (const link of ["invalid", "https://evil.example/MLB123456789", "http://meli.la/a", "https://user:pass@meli.la/a"]) assert.equal(collectionEntry.safeParse({ affiliateUrl: link, itemId: "MLB123456789" }).success, false);
  assert.equal(collectionEntry.safeParse({ affiliateUrl: "https://produto.mercadolivre.com.br/MLB-123456789-a", itemId: "MLB999999999" }).success, false);
});
test("lote preserva número de linha e permite correção sem perder entradas", () => {
  const rows = parseCollectionLines("\nhttps://meli.la/a;MLB123456789;Produto\nhttps://meli.la/b\n");
  assert.equal(rows[0].line, 2); assert.equal(rows[0].data.title, "Produto");
  assert.equal(rows[1].line, 3); assert.equal(rows[1].data, null); assert.ok(rows[1].error);
});
