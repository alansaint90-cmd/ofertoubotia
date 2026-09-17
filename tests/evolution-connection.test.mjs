import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { connectionState, connect } from "../src/lib/evolution/client.ts";
import { hasSetupSession, sameOrigin, sessionCookie, setupReady, validSetupToken } from "../src/lib/evolution/setup.ts";

const names = ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME", "EVOLUTION_SETUP_TOKEN"];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;

before(() => {
  process.env.EVOLUTION_API_URL = "https://evolution.example.test";
  process.env.EVOLUTION_API_KEY = "test-api-key";
  process.env.EVOLUTION_INSTANCE_NAME = "ofertou-test";
  process.env.EVOLUTION_SETUP_TOKEN = "test-only-setup-token-with-at-least-32-characters";
});
after(() => {
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
  globalThis.fetch = originalFetch;
});

test("sessão de configuração exige chave e expira quando a chave muda", () => {
  assert.equal(setupReady(), true);
  assert.equal(validSetupToken("incorreta"), false);
  assert.equal(validSetupToken(process.env.EVOLUTION_SETUP_TOKEN), true);
  const cookie = sessionCookie().split(";")[0];
  const request = new Request("https://ofertou.example.test/api/integrations/evolution", { headers: { cookie } });
  assert.equal(hasSetupSession(request), true);
  process.env.EVOLUTION_SETUP_TOKEN = "another-test-setup-token-with-at-least-32-characters";
  assert.equal(hasSetupSession(request), false);
  process.env.EVOLUTION_SETUP_TOKEN = "test-only-setup-token-with-at-least-32-characters";
});

test("operações de escrita exigem mesma origem", () => {
  const url = "https://ofertou.example.test/api/integrations/evolution";
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://ofertou.example.test" } })), true);
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://outra.example.test" } })), false);
  assert.equal(sameOrigin(new Request(url)), false);
});

test("consulta de estado usa chave somente na chamada servidor a servidor", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://evolution.example.test/instance/connectionState/ofertou-test");
    assert.equal(options.headers.apikey, "test-api-key");
    return Response.json({ instance: { state: "open" } });
  };
  assert.deepEqual(await connectionState(), { state: "open", qr: null });
});

test("conexão aceita apenas imagem QR codificada em base64", async () => {
  globalThis.fetch = async () => Response.json({ base64: "aGVsbG8=", instance: { state: "connecting" } });
  assert.deepEqual(await connect(), { state: "connecting", qr: "data:image/png;base64,aGVsbG8=" });
  globalThis.fetch = async () => Response.json({ base64: "https://evil.example/qr" });
  assert.equal((await connect()).qr, null);
});
