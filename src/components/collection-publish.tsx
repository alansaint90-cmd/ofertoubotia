"use client";
import { useState } from "react";
import Image from "next/image";
import { LiveHistory } from "./live-history";
import type { ProductDetails } from "@/lib/integrations/product-review";
type Item = { id: string; title: string; affiliateUrl: string; updatedAt: string; isActive: boolean; details: Partial<ProductDetails> };
const errors: Record<string, string> = { unauthorized: "Libere a conexão WhatsApp em Integrações antes de publicar.", group_not_bound: "Autorize seu grupo em Integrações.", duplicate_24h: "Este produto já está na fila ou foi aceito nas últimas 24 horas.", product_changed: "Produto alterado ou pausado. Atualize a lista e revise novamente.", review_required: "Revise e salve os dados completos na coleção primeiro.", dispatch_unavailable: "Fila indisponível. Confira banco e workspace.", forbidden: "Origem recusada. Confira o domínio configurado." };
export function CollectionPublish() {
  const [groupName, setGroupName] = useState("");
  const [key, setKey] = useState(""); const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState<Item | null>(null);
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [requestId, setRequestId] = useState(""); const [queued, setQueued] = useState(false);
  async function load() {
    setBusy(true); setMessage("");
    try {
      if (key) {
        const unlocked = await fetch("/api/integrations/mercadolivre/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlock", token: key }) });
        if (!unlocked.ok) throw new Error("Chave de produtos inválida ou acesso indisponível."); setKey("");
      }
      const response = await fetch("/api/integrations/mercadolivre/products/collection"); const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const groupResponse = await fetch("/api/integrations/evolution/group");
      const groupResult = groupResponse.ok ? await groupResponse.json() : null;
      setGroupName(groupResult?.group?.name ?? "");
      setItems(result.items); setSelected(null); setMessage(result.items.length ? "Coleção atualizada." : "Cadastre produtos em Integrações primeiro.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao carregar."); } finally { setBusy(false); }
  }
  async function publish() {
    if (!selected || !confirmed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/dispatches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, productId: selected.id, updatedAt: selected.updatedAt, confirmed: true }) });
      const result = await response.json(); if (!response.ok) throw new Error(errors[result.error] || "Não foi possível enfileirar.");
      setQueued(true); setMessage("Oferta na fila. Acompanhe no Histórico; o worker enviará foto e legenda ao grupo autorizado.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha de rede. Você pode tentar novamente sem duplicar a solicitação."); } finally { setBusy(false); }
  }
  return <section className="panel"><h2>Produtos da sua coleção</h2><p>Dados reais salvos em Integrações. Revise o preço no anúncio antes de publicar.</p>
    <form onSubmit={e => { e.preventDefault(); void load(); }}><label className="field">Chave de produtos (se o acesso expirou)<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/></label><button className="button outline" disabled={busy}>Carregar / atualizar coleção</button></form>
    <label className="field">Buscar na coleção<input value={query} onChange={e => setQuery(e.target.value)}/></label>
    <div className="product-grid">{items.filter(item => item.title.toLowerCase().includes(query.toLowerCase())).map(item => <article className="panel" key={item.id}><h3>{item.title}</h3><p>{item.details.price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {item.isActive ? "Ativo" : "Pausado"}</p><button className="button primary" disabled={busy || !item.isActive || !item.details.reviewedAt} onClick={() => { setSelected(item); setConfirmed(false); setQueued(false); setRequestId(crypto.randomUUID()); }}>Criar oferta</button></article>)}</div>
    {selected && <div className="panel"><h3>Revisar oferta</h3>{selected.details.imageUrl && <Image unoptimized src={selected.details.imageUrl} width={320} height={220} alt={selected.title} style={{ objectFit: "contain" }}/>}<h4>{selected.details.title}</h4><p>{selected.details.price?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p><p style={{ whiteSpace: "pre-wrap" }}>{selected.details.description}</p><a href={selected.affiliateUrl} target="_blank" rel="noreferrer">{selected.affiliateUrl}</a><p>Destino: {groupName || "Libere a conexão WhatsApp em Integrações e atualize a coleção."}. Para editar a copy ou os dados, salve a alteração na coleção e atualize esta lista.</p><label><input type="checkbox" checked={confirmed} disabled={queued || busy} onChange={e => setConfirmed(e.target.checked)}/> Conferi foto, preço atual, condições, copy, link e grupo autorizado.</label><button className="button primary" disabled={!confirmed || queued || busy || !groupName} onClick={() => void publish()}>Publicar no grupo autorizado</button></div>}
    <p role="status">{busy ? "Processando…" : message}</p>{queued && <LiveHistory/>}
  </section>;
}
