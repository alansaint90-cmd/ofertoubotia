import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { connectionState, connect } from "../src/lib/evolution/client.ts";
import { hasSetupSession, sameOrigin, sessionCookie, setupReady, validSetupToken } from "../src/lib/evolution/setup.ts";

const names = ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME", "EVOLUTION_SETUP_TOKEN", "OFERTOU_PUBLIC_ORIGIN"];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;

before(() => {
  delete process.env.OFERTOU_PUBLIC_ORIGIN;
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

test("acesso persiste além de uma hora, renova e expira após inatividade", () => {
  const now = Date.now;
  let time = now();
  Date.now = () => time;
  try {
    const requestFor = cookie => new Request("https://ofertou.example.test/api/integrations/evolution", { headers: { cookie: cookie.split(";")[0] } });
    const cookie = sessionCookie();
    assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/api; Max-Age=2592000/);
    const request = requestFor(cookie);
    time += 29 * 86400000;
    assert.equal(hasSetupSession(request), true);
    const renewed = requestFor(sessionCookie());
    time += 2 * 86400000;
    assert.equal(hasSetupSession(request), false);
    assert.equal(hasSetupSession(renewed), true);
    time += 30 * 86400000;
    assert.equal(hasSetupSession(renewed), false);
  } finally { Date.now = now; }
});

test("operações de escrita exigem mesma origem", () => {
  const url = "https://ofertou.example.test/api/integrations/evolution";
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://ofertou.example.test" } })), true);
  assert.equal(sameOrigin(new Request(url, { headers: { origin: "https://outra.example.test" } })), false);
  assert.equal(sameOrigin(new Request(url)), false);
  process.env.OFERTOU_PUBLIC_ORIGIN = "https://ofertou.example.test";
  const internalUrl = "http://ofertouia:3000/api/integrations/evolution";
  assert.equal(sameOrigin(new Request(internalUrl, { headers: { origin: "https://ofertou.example.test" } })), true);
  assert.equal(sameOrigin(new Request(internalUrl, { headers: { origin: "https://outra.example.test" } })), false);
  process.env.OFERTOU_PUBLIC_ORIGIN = "https://ofertou.example.test/path";
  assert.equal(sameOrigin(new Request(internalUrl, { headers: { origin: "https://ofertou.example.test" } })), false);
  delete process.env.OFERTOU_PUBLIC_ORIGIN;
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
