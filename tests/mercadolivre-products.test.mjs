import assert from "node:assert/strict";
import { test } from "node:test";
import { queryRealProducts, productSchema } from "../src/lib/integrations/mercadolivre-products.ts";
import { refreshMercadoLivreToken } from "../src/lib/integrations/mercadolivre.ts";

test("consulta usa bearer no servidor e devolve somente campos públicos", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    assert.equal(url.includes("test-secret"), false);
    if (url.includes("/users/")) return Response.json({ results: ["MLB123456789"], paging: { total: 11 } });
    return Response.json({ id: "MLB123456789", title: "Produto real", price: 10, currency_id: "BRL", status: "active", permalink: "https://produto.mercadolivre.com.br/MLB-123456789", private_data: "omit" });
  };
  try {
    const result = await queryRealProducts("test-secret", "123");
    assert.equal(result.nextOffset, 1);
    assert.equal(result.products[0].title, "Produto real");
    assert.equal("private_data" in result.products[0], false);
    await assert.rejects(() => queryRealProducts("test-secret", "123", "https://evil.example"));
  } finally { globalThis.fetch = original; }
});

test("não transforma erros da API em produtos demo e recusa links externos", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 403 });
  try { await assert.rejects(() => queryRealProducts("test", "123", "MLB123456789"), /permission_denied/); }
  finally { globalThis.fetch = original; }
  assert.equal(productSchema.parse({ id: "MLB123456789", title: "Teste", price: null, currency_id: "BRL", status: "active", permalink: "https://evil.example/" }).url, null);
});

test("renovação usa refresh_token e guarda o par novo com validade do provedor", async () => {
  const original = globalThis.fetch;
  const names = ["MERCADO_LIVRE_CLIENT_ID", "MERCADO_LIVRE_CLIENT_SECRET", "MERCADO_LIVRE_REDIRECT_URI"];
  const saved = names.map(name => process.env[name]);
  process.env.MERCADO_LIVRE_CLIENT_ID = "123";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = "test-secret";
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://example.com/callback";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.mercadolibre.com/oauth/token");
    assert.equal(options.body.get("grant_type"), "refresh_token");
    assert.equal(options.body.get("refresh_token"), "old-refresh");
    return Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600, user_id: 123 });
  };
  try {
    const result = await refreshMercadoLivreToken("old-refresh");
    assert.equal(result.refreshToken, "new-refresh");
    assert.equal(result.userId, "123");
    assert.ok(Date.parse(result.expiresAt) > Date.now() + 3500000);
    globalThis.fetch = async () => new Response("", { status: 400 });
    await assert.rejects(() => refreshMercadoLivreToken("old-refresh"), /reconnect_required/);
  } finally {
    globalThis.fetch = original;
    names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; });
  }
});
