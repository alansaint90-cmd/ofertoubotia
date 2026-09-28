import assert from "node:assert/strict";
import { after, test } from "node:test";
import { credentialsEncryptionReady, encryptCredentials } from "../src/lib/integrations/credentials.ts";

const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
after(() => {
  if (original === undefined) delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  else process.env.INTEGRATIONS_ENCRYPTION_KEY = original;
});

test("credenciais exigem chave de 32 bytes e produzem cifra autenticada", () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "curta";
  assert.equal(credentialsEncryptionReady(), false);
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
  assert.equal(credentialsEncryptionReady(), true);
  const first = encryptCredentials({ apiToken: "segredo-de-teste" });
  const second = encryptCredentials({ apiToken: "segredo-de-teste" });
  assert.match(first, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("segredo-de-teste"), false);
});
