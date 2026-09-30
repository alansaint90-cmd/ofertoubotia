import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

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

export function decryptCredentials(value: string): Record<string, string> {
  const [version, ivValue, tagValue, encryptedValue, ...extra] = value.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue || extra.length) throw new Error("encrypted_credentials_invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const clear = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  const parsed: unknown = JSON.parse(clear);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("encrypted_credentials_invalid");
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
