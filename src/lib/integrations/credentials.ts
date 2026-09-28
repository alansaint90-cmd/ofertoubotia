import { createCipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey(): Buffer {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error("encryption_key_missing");
  const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("encryption_key_invalid");
  return key;
}

export function credentialsEncryptionReady(): boolean {
  try { encryptionKey(); return true; } catch { return false; }
}

export function encryptCredentials(value: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}
