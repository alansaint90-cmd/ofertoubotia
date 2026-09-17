import assert from "node:assert/strict";
import test from "node:test";
import { discount, makeCopy, money, products } from "../src/lib/demo.ts";

test("desconto e preço usam os dados do produto", () => {
  assert.equal(discount(products[0]), 44);
  assert.equal(money(products[0].price), "R$ 279,90");
});

test("copy demonstrativa usa um marcador claro quando falta link", () => {
  const copy = makeCopy(products[0], "Achadinho", "");
  assert.match(copy, /R\$\s279,90/);
  assert.match(copy, /44% de desconto/);
  assert.match(copy, /\[adicione seu link de afiliado\]/);
  assert.doesNotMatch(copy, /frete grátis|estoque|cupom/i);
});
