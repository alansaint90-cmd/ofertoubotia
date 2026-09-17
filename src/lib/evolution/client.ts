import { z } from "zod";

const stateSchema = z.object({ instance: z.object({ state: z.string().optional() }).optional() });
const qrSchema = z.object({ base64: z.string().optional(), qrcode: z.object({ base64: z.string().optional() }).optional(), instance: z.object({ state: z.string().optional(), status: z.string().optional() }).optional(), error: z.boolean().optional() });

export type EvolutionResult = { state: "open" | "connecting" | "close" | "unknown"; qr: string | null };

function config() {
  const url = new URL(process.env.EVOLUTION_API_URL!);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("invalid_configuration");
  return { url, key: process.env.EVOLUTION_API_KEY!, instance: process.env.EVOLUTION_INSTANCE_NAME! };
}

async function call(path: string): Promise<unknown> {
  const { url, key } = config();
  const target = new URL(path, `${url.toString().replace(/\/$/, "")}/`);
  const response = await fetch(target, { headers: { apikey: key, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`evolution_http_${response.status}`);
  return response.json();
}

function state(value: unknown): EvolutionResult["state"] {
  return value === "open" || value === "connecting" || value === "close" ? value : "unknown";
}

export async function connectionState(): Promise<EvolutionResult> {
  const { instance } = config();
  const parsed = stateSchema.parse(await call(`instance/connectionState/${encodeURIComponent(instance)}`));
  return { state: state(parsed.instance?.state), qr: null };
}

export async function connect(): Promise<EvolutionResult> {
  const { instance } = config();
  const parsed = qrSchema.parse(await call(`instance/connect/${encodeURIComponent(instance)}`));
  if (parsed.error) throw new Error("evolution_connect_failed");
  const raw = parsed.base64 ?? parsed.qrcode?.base64;
  const qr = raw && /^(data:image\/png;base64,)?[a-zA-Z0-9+/=]+$/.test(raw) && raw.length <= 500000
    ? raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}` : null;
  return { state: state(parsed.instance?.state ?? parsed.instance?.status ?? (qr ? "connecting" : undefined)), qr };
}
