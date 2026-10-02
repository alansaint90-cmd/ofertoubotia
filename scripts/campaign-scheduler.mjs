import { randomUUID } from 'node:crypto';
import { allowedDispatchTarget } from '../src/lib/evolution/target-code.ts';
import { dispatchMediaPayload } from '../src/lib/evolution/dispatch-media.ts';

export async function scheduleCampaign(pool, workspace, instance) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows: owners } = await client.query(`select u.id from workspaces w join users u on u.id=w.owner_id join user_credentials c on c.user_id=u.id join workspace_members m on m.workspace_id=w.id and m.user_id=u.id where w.id=$1 and w.is_deleted=false and u.is_deleted=false and c.is_deleted=false and c.is_active=true and m.is_deleted=false and m.role in ('owner','admin','operador')`, [workspace]);
    if (!owners.length) { await client.query('commit'); return; }
    const { rows: campaigns } = await client.query(`select *, extract(hour from now() at time zone 'America/Sao_Paulo') as local_hour from campaigns where workspace_id=$1 and active=true and is_deleted=false and next_at<=now() for update skip locked`, [workspace]);
    for (const c of campaigns) {
      if (c.local_hour < c.start_hour || c.local_hour >= c.end_hour) continue;
      const { rows: pending } = await client.query(`select id from dispatches where workspace_id=$1 and is_deleted=false and (status in ('queued','processing') or sent_at > now() - interval '1 minute' * $2) limit 1`, [workspace,c.interval_minutes]);
      if (pending.length) continue;
      const { rows: groups } = await client.query(`select g.* from whatsapp_groups g join whatsapp_instances i on i.id=g.instance_id and i.workspace_id=g.workspace_id where g.workspace_id=$1 and g.is_active=true and g.is_deleted=false and i.is_deleted=false and i.instance_name=$2`, [workspace, instance]);
      const group = groups.find(g => allowedDispatchTarget(g.external_group_id, g.metadata));
      if (!group) continue;
      // Workspace lock shared with manual publishing is per product; daily checks include manual sends.
      for (const id of c.product_ids) {
        await client.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [workspace, id]);
        const { rows: products } = await client.query(`select * from product_collection where id=$1 and workspace_id=$2 and is_deleted=false and is_active=true for update`, [id, workspace]);
        const p = products[0], d = p?.details;
        if (!d?.reviewedAt || !Number.isFinite(Date.parse(d.reviewedAt)) || Date.parse(d.reviewedAt) < Date.now()-c.review_hours*3600000 || !d.title || !(d.price>0)) continue;
        const { rows: used } = await client.query(`select d.id from dispatches d join offers o on o.id=d.offer_id where d.workspace_id=$1 and o.workspace_id=$1 and o.external_product_id=$2 and d.is_deleted=false and o.is_deleted=false and (d.created_at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date limit 1`, [workspace,id]);
        if (used.length) continue;
        const body = `${d.title}\n\n${/R\$/.test(d.description || '') ? '' : Number(d.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'\n\n'}${d.description || ''}\n\n🛒 ${p.affiliate_url}`;
        try { dispatchMediaPayload(group.external_group_id,body,{source:'collection',imageUrl:d.imageUrl}); } catch { continue; }
        const offerId=randomUUID(), dispatchId=randomUUID();
        await client.query(`insert into offers (id,workspace_id,provider,external_product_id,product_snapshot,headline,body,status,created_by,modified_by) values ($1,$2,'campaign',$3,$4,$5,$6,'queued',$7,$7)`,[offerId,workspace,id,JSON.stringify({...d,source:'collection',campaignId:c.id,affiliateLink:p.affiliate_url}),d.title,body,c.modified_by]);
        await client.query(`insert into dispatches (id,request_id,workspace_id,offer_id,group_id,status,queued_at,modified_by) values ($1,$2,$3,$4,$5,'queued',now(),$6)`,[dispatchId,randomUUID(),workspace,offerId,group.id,c.modified_by]);
        await client.query(`insert into audit_logs (workspace_id,actor_id,operation,entity_type,entity_id,modified_by) values ($1,$2,'campaign.queued','dispatch',$3,$2)`,[workspace,c.modified_by,dispatchId]);
        break;
      }
      await client.query(`update campaigns set next_at=now()+interval '1 minute'*interval_minutes,updated_at=now() where id=$1`,[c.id]);
    }
    await client.query('commit');
  } catch(e) { await client.query('rollback'); throw e; } finally { client.release(); }
}
