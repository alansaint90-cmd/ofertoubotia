import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedDispatchTarget, targetInviteCode, TARGET_INVITE_HASH } from "../src/lib/evolution/target-code.ts";

test("somente o convite do grupo autorizado é aceito", () => {
  assert.equal(targetInviteCode("https://chat.whatsapp.com/JTl5vejtLEpKu6otgRXQsn"), "JTl5vejtLEpKu6otgRXQsn");
  assert.equal(targetInviteCode("https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAAAAAA"), null);
  assert.equal(targetInviteCode("https://chat.whatsapp.com.evil.test/JTl5vejtLEpKu6otgRXQsn"), null);
  assert.equal(targetInviteCode("http://chat.whatsapp.com/JTl5vejtLEpKu6otgRXQsn"), null);
  assert.equal(targetInviteCode("https://chat.whatsapp.com/JTl5vejtLEpKu6otgRXQsn?redirect=1"), null);
});

test("worker recusa destino sem vínculo com o convite permitido", () => {
  assert.equal(allowedDispatchTarget("120363024158769234@g.us", { inviteHash: TARGET_INVITE_HASH }), true);
  assert.equal(allowedDispatchTarget("5511999999999@s.whatsapp.net", { inviteHash: TARGET_INVITE_HASH }), false);
  assert.equal(allowedDispatchTarget("120363024158769234@g.us", { inviteHash: "outro" }), false);
});
