"use client";
import { useState } from "react";
import { LiveHistory } from "./live-history";
type Product = { id: string; title: string; isActive: boolean; details: { reviewedAt?: string } };
export function CampaignPanel() {
  const [checkedAt,setCheckedAt]=useState(0);
  const [key,setKey]=useState(""); const [unlocked,setUnlocked]=useState(false);
  const [products,setProducts]=useState<Product[]>([]); const [ids,setIds]=useState<string[]>([]);
  const [start,setStart]=useState(8); const [end,setEnd]=useState(22); const [interval,setInterval]=useState(10); const [hours,setHours]=useState(24);
  const [active,setActive]=useState(false); const [confirmed,setConfirmed]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function run(action: "unlock"|"load"|"save"|"pause", enable=false) {
    setBusy(true); setMessage("");
    try {
      const call=async (payload: object) => { const r=await fetch('/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await r.json(); if(!r.ok) throw new Error(data.error); return data; };
      if(action==='unlock') { await call({action,token:key}); setKey(''); setUnlocked(true); }
      const data=await call(action==='save'?{action,productIds:ids,startHour:start,endHour:end,intervalMinutes:interval,reviewHours:hours,active:enable,confirmed:true}:{action:action==='pause'?'pause':'load'});
      setProducts(data.products); setCheckedAt(Date.now());
      if(data.campaign) { const c=data.campaign; setIds(c.productIds);setStart(c.startHour);setEnd(c.endHour);setInterval(c.intervalMinutes);setHours(c.reviewHours);setActive(c.active); }
      setConfirmed(false);setMessage(action==='save'?(enable?'Campanha ativada. O worker fará os envios na janela configurada.':'Campanha pausada. Um envio já em andamento pode concluir.'):'Configuração carregada.');
    }catch(e){setMessage(e instanceof Error?e.message:'Falha de rede.');}finally{setBusy(false);}
  }
  return <section className="panel"><h2>Campanha automática</h2><p>Um produto a cada intervalo, no único grupo autorizado em Integrações. Horário de Brasília. Não repete produtos no mesmo dia, incluindo tentativas com falha. Ao terminar a lista, aguarda o próximo dia.</p>
  {!unlocked?<form onSubmit={e=>{e.preventDefault();void run('unlock');}}><label className="field">Chave da campanha<input type="password" minLength={32} required value={key} onChange={e=>setKey(e.target.value)}/></label><button className="button primary" disabled={busy}>Liberar campanha por 1 hora</button></form>:<>
  <p><strong>{active?'Campanha ativa':'Campanha pausada'}</strong></p><button className="button outline" disabled={busy} onClick={()=>void run('load')}>Atualizar</button>
  <fieldset disabled={busy} onChange={()=>setConfirmed(false)}><legend>Configuração e produtos</legend>
  <label className="field">Hora inicial (0–23)<input type="number" min={0} max={23} value={start} onChange={e=>setStart(Number(e.target.value))}/></label>
  <label className="field">Hora final (1–24)<input type="number" min={1} max={24} value={end} onChange={e=>setEnd(Number(e.target.value))}/></label>
  <label className="field">Intervalo<select value={interval} onChange={e=>setInterval(Number(e.target.value))}><option value={5}>5 minutos</option><option value={10}>10 minutos</option></select></label>
  <label className="field">Validade da revisão (1–24 horas)<input type="number" min={1} max={24} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
  {products.map(p=><label key={p.id} style={{display:'block',padding:8}}><input type="checkbox" checked={ids.includes(p.id)} onChange={e=>setIds(e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/>{p.title} — {!p.isActive?'Pausado':!p.details.reviewedAt || Date.parse(p.details.reviewedAt)<checkedAt-hours*3600000?'Revisão vencida ou pendente; não será enviado':'Revisado'}</label>)}
  </fieldset><p>{ids.length} produtos · {start}h às {end}h · a cada {interval} minutos. Produtos pausados, excluídos ou com revisão vencida serão ignorados. Preços não são atualizados automaticamente.</p>
  <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Revisei os produtos, horários e o grupo autorizado e autorizo os envios automáticos.</label>
  <div className="editor-actions"><button className="button primary" disabled={busy||!confirmed||!ids.length||start>=end} onClick={()=>void run('save',true)}>Salvar e ativar</button><button className="button outline" disabled={busy} onClick={()=>void run('pause')}>Pausar campanha</button></div><LiveHistory/>
  </>}<p role="status">{busy?'Processando…':message}</p></section>;
}
