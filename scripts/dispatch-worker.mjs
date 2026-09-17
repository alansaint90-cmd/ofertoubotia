import pg from "pg";
import { allowedDispatchTarget } from "../src/lib/evolution/target-code.ts";

const required = ["DATABASE_URL", "EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME", "EVOLUTION_WORKSPACE_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);
const base = new URL(process.env.EVOLUTION_API_URL);
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("Invalid EVOLUTION_API_URL");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let stopping = false;

const endpoint = path => new URL(path, `${base.toString().replace(/\/$/, "")}/`);
const apiHeaders = { apikey: process.env.EVOLUTION_API_KEY, Accept: "application/json" };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function audit(client, job, operation, metadata = {}) {
  await client.query("insert into audit_logs (workspace_id, actor_id, operation, entity_type, entity_id, metadata, modified_by) values ($1,$2,$3,'dispatch',$4,$5,$2)",
    [job.workspace_id, job.actor_id, operation, job.id, JSON.stringify({ source: "evolution_worker", ...metadata })]);
}

async function claim() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(`
      select d.id, d.workspace_id, d.attempts, d.group_id, d.offer_id, o.body, o.created_by as actor_id,
             g.external_group_id, g.metadata, g.is_active, i.instance_name
      from dispatches d
      join offers o on o.id = d.offer_id and o.is_deleted = false
      join whatsapp_groups g on g.id = d.group_id and g.is_deleted = false
      join whatsapp_instances i on i.id = g.instance_id and i.is_deleted = false
      where d.workspace_id = $1 and d.status = 'queued' and d.is_deleted = false
        and d.queued_at <= now() and d.attempts < 3
      order by d.queued_at, d.id
      for update of d skip locked limit 1`, [process.env.EVOLUTION_WORKSPACE_ID]);
    const job = result.rows[0];
    if (!job) { await client.query("commit"); return null; }
    if (!job.is_active || !allowedDispatchTarget(job.external_group_id, job.metadata) || job.instance_name !== process.env.EVOLUTION_INSTANCE_NAME) {
      await client.query("update dispatches set status='failed', last_error='target_not_allowed', updated_at=now(), modified_by=$2 where id=$1", [job.id, job.actor_id]);
      await client.query("update offers set status='failed', updated_at=now(), modified_by=$2 where id=$1", [job.offer_id, job.actor_id]);
      await audit(client, job, "dispatch.failed", { reason: "target_not_allowed" });
      await client.query("commit"); return null;
    }
    await client.query("update dispatches set status='processing', attempts=attempts+1, updated_at=now(), modified_by=$2 where id=$1", [job.id, job.actor_id]);
    await client.query("commit");
    return job;
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

async function finish(job, status, messageId = null, reason = null) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update dispatches set status=$2, external_message_id=$3, last_error=$4, sent_at=case when $2='accepted' then now() else sent_at end, updated_at=now(), modified_by=$5 where id=$1 and status='processing'", [job.id, status, messageId, reason, job.actor_id]);
    await client.query("update offers set status=$2, updated_at=now(), modified_by=$3 where id=$1", [job.offer_id, status, job.actor_id]);
    await audit(client, job, `dispatch.${status}`, reason ? { reason } : {});
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

async function retryBeforeSend(job, reason) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const status = job.attempts + 1 >= 3 ? "failed" : "queued";
    await client.query("update dispatches set status=$2, queued_at=now()+interval '60 seconds', last_error=$4, updated_at=now(), modified_by=$3 where id=$1 and status='processing'", [job.id, status, job.actor_id, reason]);
    if (status === "failed") await client.query("update offers set status='failed', updated_at=now(), modified_by=$2 where id=$1", [job.offer_id, job.actor_id]);
    await audit(client, job, `dispatch.${status}`, { reason });
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

async function processJob(job) {
  const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE_NAME);
  try {
    const response = await fetch(endpoint(`instance/connectionState/${instance}`), { headers: apiHeaders, signal: AbortSignal.timeout(10000) });
    if (!response.ok) { await retryBeforeSend(job, "state_check_failed"); return; }
    const state = await response.json();
    if (state?.instance?.state !== "open") { await retryBeforeSend(job, "whatsapp_not_connected"); return; }
  } catch { await retryBeforeSend(job, "state_check_failed"); return; }

  try {
    const response = await fetch(endpoint(`message/sendText/${instance}`), {
      method: "POST", headers: { ...apiHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ number: job.external_group_id, text: job.body }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) { await finish(job, response.status >= 500 ? "uncertain" : "failed", null, `evolution_http_${response.status}`); return; }
    const payload = await response.json();
    const messageId = typeof payload?.key?.id === "string" ? payload.key.id : null;
    if (!messageId || payload?.key?.remoteJid !== job.external_group_id) { await finish(job, "uncertain", null, "unexpected_response"); return; }
    await finish(job, "accepted", messageId);
  } catch { await finish(job, "uncertain", null, "send_result_unknown"); }
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
console.info("Ofertou Evolution worker started");
try {
  while (!stopping) {
    try { const job = await claim(); if (job) await processJob(job); else await wait(5000); }
    catch { console.error("Evolution worker cycle failed"); await wait(5000); }
  }
} finally { await pool.end(); }
