import { cookies } from "next/headers";
import { setupActor } from "@/lib/db/runtime";
import { hasSetupSession, sameOrigin, setupReady } from "@/lib/evolution/setup";
import { authorizationUrl, createOAuthState, mercadoLivreReady, ML_STATE_COOKIE } from "@/lib/integrations/mercadolivre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!setupReady() || !hasSetupSession(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!mercadoLivreReady()) return Response.json({ error: "not_configured" }, { status: 503 });
  try {
    const { workspaceId } = await setupActor("integrations:manage");
    const state = createOAuthState(workspaceId);
    const jar = await cookies();
    jar.set(ML_STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/mercadolivre", maxAge: 600 });
    return Response.json({ authorizationUrl: authorizationUrl(state).toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "authorization_failed" }, { status: 503 });
  }
}
