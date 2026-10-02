import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleCampaign } from '../scripts/campaign-scheduler.mjs';
test('campanha não consulta produtos fora do horário nem acumula fila pendente', async () => {
  for (const hour of [7,9]) {
    const statements=[];
    const client={release(){},async query(sql){statements.push(sql); if(sql.includes('select u.id'))return {rows:[{id:'owner'}]}; if(sql.includes('from campaigns'))return {rows:[{local_hour:hour,start_hour:8,end_hour:22,interval_minutes:10}]}; if(sql.includes('from dispatches'))return {rows:[{id:'pending'}]}; return {rows:[]};}};
    await scheduleCampaign({connect:async()=>client},'workspace','instance');
    assert.equal(statements.some(s=>s.includes('insert into offers')),false);
    assert.equal(statements.some(s=>s.includes('from product_collection')),false);
    assert.equal(statements.at(-1),'commit');
  }
});
