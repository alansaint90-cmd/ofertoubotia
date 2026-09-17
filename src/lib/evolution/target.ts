import { z } from "zod";
import { connectionState, evolutionRequest } from "./client";
import { targetInviteCode } from "./target-code";

export { TARGET_INVITE_HASH } from "./target-code";

const groupIdSchema = z.string().regex(/^[0-9-]{10,40}@g\.us$/);
const inviteInfoSchema = z.object({ id: groupIdSchema, subject: z.string().min(1).max(200) });
const groupListSchema = z.array(z.object({ id: groupIdSchema, subject: z.string().optional() }));

export async function resolveAllowedGroup(link: string): Promise<{ id: string; subject: string }> {
  const code = targetInviteCode(link);
  if (!code) throw new Error("wrong_group");
  const state = await connectionState();
  if (state.state !== "open") throw new Error("whatsapp_not_connected");
  const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE_NAME!);
  const info = inviteInfoSchema.parse(await evolutionRequest(`group/inviteInfo/${instance}?inviteCode=${encodeURIComponent(code)}`));
  const groups = groupListSchema.parse(await evolutionRequest(`group/fetchAllGroups/${instance}?getParticipants=false`));
  if (!groups.some(group => group.id === info.id)) throw new Error("not_group_member");
  return { id: info.id, subject: info.subject };
}
