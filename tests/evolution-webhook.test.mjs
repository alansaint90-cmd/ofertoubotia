import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { POST } from "../src/app/api/webhooks/evolution/route.ts";

const originalSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
const originalInstance = process.env.EVOLUTION_INSTANCE_NAME;
const secret = "test-only-secret-with-at-least-32-characters";

before(() => {
  process.env.EVOLUTION_WEBHOOK_SECRET = secret;
  process.env.EVOLUTION_INSTANCE_NAME = "ofertou-demo";
});
after(() => {
  if (originalSecret === undefined) delete process.env.EVOLUTION_WEBHOOK_SECRET;
  else process.env.EVOLUTION_WEBHOOK_SECRET = originalSecret;
  if (originalInstance === undefined) delete process.env.EVOLUTION_INSTANCE_NAME;
  else process.env.EVOLUTION_INSTANCE_NAME = originalInstance;
});

const send = (payload, headers = {}) => POST(new Request("http://localhost/api/webhooks/evolution", {
  method: "POST",
  headers: { "content-type": "application/json", "x-ofertou-webhook-secret": secret, ...headers },
  body: typeof payload === "string" ? payload : JSON.stringify(payload),
}));

test("recusa chamada sem segredo", async () => {
  const response = await send({ event: "connection.update", instance: "ofertou-demo" }, { "x-ofertou-webhook-secret": "" });
  assert.equal(response.status, 401);
});

test("recusa eventos de outra instância", async () => {
  const response = await send({ event: "connection.update", instance: "outra" });
  assert.equal(response.status, 403);
});

test("valida JSON e tamanho do corpo", async () => {
  assert.equal((await send("{" )).status, 400);
  assert.equal((await send({ event: "connection.update" })).status, 400);
  assert.equal((await send({ event: "connection.update", instance: "ofertou-demo", data: "x".repeat(256 * 1024) })).status, 413);
});

test("aceita evento autenticado sem fingir processamento", async () => {
  const response = await send({ event: "connection.update", instance: "ofertou-demo", data: { state: "open" } });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { received: true, processed: false });
});

test("fica fechado se não estiver configurado", async () => {
  delete process.env.EVOLUTION_WEBHOOK_SECRET;
  const response = await send({ event: "connection.update", instance: "ofertou-demo" });
  assert.equal(response.status, 503);
  process.env.EVOLUTION_WEBHOOK_SECRET = secret;
});
