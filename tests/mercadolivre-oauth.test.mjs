import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { authorizationUrl, createOAuthState, integrationReturnUrl, verifyOAuthState } from "../src/lib/integrations/mercadolivre.ts";

const original = {
  clientId: process.env.MERCADO_LIVRE_CLIENT_ID,
  clientSecret: process.env.MERCADO_LIVRE_CLIENT_SECRET,
  redirectUri: process.env.MERCADO_LIVRE_REDIRECT_URI,
};

before(() => {
  process.env.MERCADO_LIVRE_CLIENT_ID = "123456789";
  process.env.MERCADO_LIVRE_CLIENT_SECRET = "segredo-de-teste-que-nao-e-real";
  process.env.MERCADO_LIVRE_REDIRECT_URI = "https://ofertou.example/api/integrations/mercadolivre/callback";
});

after(() => {
  for (const [key, value] of Object.entries({
    MERCADO_LIVRE_CLIENT_ID: original.clientId,
    MERCADO_LIVRE_CLIENT_SECRET: original.clientSecret,
    MERCADO_LIVRE_REDIRECT_URI: original.redirectUri,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("OAuth do Mercado Livre vincula o estado ao workspace e ao cookie", () => {
  const state = createOAuthState("workspace-teste");
  assert.equal(verifyOAuthState(state, state), "workspace-teste");
  assert.throws(() => verifyOAuthState(`${state}x`, state));
  assert.throws(() => verifyOAuthState(state, undefined));
});

test("URL de autorização usa somente os parâmetros oficiais configurados", () => {
  const state = createOAuthState("workspace-teste");
  const url = authorizationUrl(state);
  assert.equal(url.origin, "https://auth.mercadolivre.com.br");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "123456789");
  assert.equal(url.searchParams.get("redirect_uri"), process.env.MERCADO_LIVRE_REDIRECT_URI);
  assert.equal(url.searchParams.get("state"), state);
});

test("retorno nunca usa o host interno do container", () => {
  assert.equal(integrationReturnUrl("conectado").toString(), "https://ofertou.example/integrations?mercadolivre=conectado");
  assert.equal(integrationReturnUrl("erro", "troca_token_falhou").toString(), "https://ofertou.example/integrations?mercadolivre=erro&motivo=troca_token_falhou");
});
