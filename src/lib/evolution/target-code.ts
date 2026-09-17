import { createHash, timingSafeEqual } from "node:crypto";

// Hash do código de convite informado para esta operação. O link não é publicado no repositório.
export const TARGET_INVITE_HASH = "7692a10677005045cbe14f4bf8117ded3a3dc391f4bbd0a5d2a5cb526abc98bf";

export function targetInviteCode(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "chat.whatsapp.com" || url.search || url.hash) return null;
  const match = /^\/([a-zA-Z0-9]{22})\/?$/.exec(url.pathname);
  if (!match) return null;
  const actual = Buffer.from(createHash("sha256").update(match[1]).digest("hex"));
  const expected = Buffer.from(TARGET_INVITE_HASH);
  return timingSafeEqual(actual, expected) ? match[1] : null;
}

export function allowedDispatchTarget(groupId: unknown, metadata: unknown): boolean {
  return typeof groupId === "string" && /^[0-9-]{10,40}@g\.us$/.test(groupId)
    && typeof metadata === "object" && metadata !== null
    && "inviteHash" in metadata && metadata.inviteHash === TARGET_INVITE_HASH;
}
