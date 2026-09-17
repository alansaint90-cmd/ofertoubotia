import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, isAccessRole } from "../src/lib/auth/access.ts";
import { hashPassword, verifyPassword, validateNewPassword, PASSWORD_MAX_BYTES } from "../src/lib/auth/password.ts";

test("Argon2id usa salt próprio e não guarda senha em claro", async () => {
  const password = "uma frase longa para o dono";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^\$argon2id\$v=19\$/);
  assert.match(first, /\bm=65536\b/);
  assert.match(first, /\bt=3\b/);
  assert.match(first, /\bp=1\b/);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(first, password), true);
  assert.equal(await verifyPassword(first, "senha incorreta"), false);
});

test("senha é verificada exatamente como recebida", async () => {
  const hash = await hashPassword("  frase secreta com espaços  ");
  assert.equal(await verifyPassword(hash, "  frase secreta com espaços  "), true);
  assert.equal(await verifyPassword(hash, "frase secreta com espaços"), false);
  assert.equal(await verifyPassword("hash inválido", "qualquer senha"), false);
});

test("política de senha rejeita valor curto e payload excessivo antes do hash", () => {
  assert.throws(() => validateNewPassword("curta"));
  assert.throws(() => validateNewPassword(" ".repeat(20)));
  assert.throws(() => validateNewPassword("a".repeat(PASSWORD_MAX_BYTES + 1)));
  assert.doesNotThrow(() => validateNewPassword("frase válida com 15 caracteres"));
});

test("RBAC separa dono, administrador, operador e visualizador", () => {
  assert.equal(hasPermission("owner", "workspace:manage"), true);
  assert.equal(hasPermission("admin", "workspace:manage"), false);
  assert.equal(hasPermission("admin", "members:manage"), true);
  assert.equal(hasPermission("operador", "offers:write"), true);
  assert.equal(hasPermission("visualizador", "offers:write"), false);
  assert.equal(hasPermission("visualizador", "offers:read"), true);
  assert.equal(isAccessRole("super_admin"), false);
  assert.equal(hasPermission("super_admin", "offers:read"), false);
});
