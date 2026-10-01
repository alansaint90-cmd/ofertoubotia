"use client";
import { useEffect, useState } from "react";

type Item = { id: string; itemId: string | null; referenceCode: string; affiliateUrl: string; title: string; isActive: boolean };
const endpoint = "/api/integrations/mercadolivre/products/collection";
export function ProductCollection() {
  const [items, setItems] = useState<Item[]>([]);
  const [entry, setEntry] = useState({ affiliateUrl: "", itemId: "", title: "" });
  const [editing, setEditing] = useState("");
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState("");
  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setItems(result.items);
  }
  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (active) setItems(result.items);
    }).catch(error => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, []);
  async function save(payload: { action: string; [key: string]: unknown }) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, ...(result.rows ?? []).filter((row: { error?: string }) => row.error).map((row: { line: number; error: string }) => `Linha ${row.line}: ${row.error}`)].join("\n"));
      setNotice(result.added !== undefined ? `${result.added} cadastrado(s); ${result.skipped} duplicado(s) ignorado(s).` : "Produto atualizado.");
      if (payload.action === "add" || payload.action === "edit") { setEntry({ affiliateUrl: "", itemId: "", title: "" }); setEditing(""); }
      if (payload.action === "batch") setBatch("");
      setRemoving("");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="collection-title">
    <h2 id="collection-title">Minha coleção de produtos</h2>
    <p>Salve seus links de afiliado. O cadastro associa o ID informado ao link; não confirma comissão ou disponibilidade e não ativa envios.</p>
    <form onSubmit={event => { event.preventDefault(); void save(editing ? { action: "edit", id: editing, entry } : { action: "add", entries: [entry] }); }}>
      <label className="field">Link de afiliado<input type="url" required maxLength={2000} value={entry.affiliateUrl} onChange={event => setEntry({ ...entry, affiliateUrl: event.target.value })}/></label>
      <label className="field">Código de referência ou ID MLB (opcional)<input value={entry.itemId} placeholder="Ex.: BU7HG1-L7MB ou MLB1234567890" onChange={event => setEntry({ ...entry, itemId: event.target.value })}/><span>Cole o código fornecido pelo Mercado Livre. Sem ID MLB, o cadastro será salvo com identificação pendente.</span></label>
      <label className="field">Nome para organizar (opcional)<input maxLength={200} value={entry.title} onChange={event => setEntry({ ...entry, title: event.target.value })}/></label>
      <div className="editor-actions"><button className="button primary" disabled={busy}>{editing ? "Salvar edição" : "Cadastrar produto"}</button>{editing && <button type="button" className="button outline" onClick={() => { setEditing(""); setEntry({ affiliateUrl: "", itemId: "", title: "" }); }}>Cancelar edição</button>}</div>
    </form>
    <details><summary>Cadastro em lote (até 200 produtos)</summary><form onSubmit={event => { event.preventDefault(); void save({ action: "batch", text: batch }); }}><label className="field">Um produto por linha: link;código opcional;nome opcional<textarea rows={7} required maxLength={450000} value={batch} onChange={event => setBatch(event.target.value)} placeholder="https://meli.la/seu-link;BU7HG1-L7MB;Nome do produto"/></label><p>Você também pode colar apenas o link. Linhas inválidas devem ser corrigidas antes de salvar. Anúncios já cadastrados serão ignorados.</p><button className="button primary" disabled={busy}>Salvar lote</button></form></details>
    <p role="status" style={{ whiteSpace: "pre-wrap" }}>{busy ? "Salvando…" : notice}</p>
    <h3>{items.length} produto(s) cadastrado(s)</h3>
    {!items.length && <p>Sua coleção está vazia. Cadastre o primeiro produto acima.</p>}
    <div className="product-grid">{items.map(item => <article className="panel" key={item.id}><h3>{item.title || item.referenceCode || item.itemId || "Produto pendente"}</h3><p>{item.itemId || "Identificação do anúncio pendente"}{item.referenceCode ? " · Referência: " + item.referenceCode : ""} · {item.isActive ? "Ativo na coleção" : "Pausado"}</p><a href={item.affiliateUrl} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{item.affiliateUrl}</a><div className="editor-actions"><button disabled={busy} className="button outline" onClick={() => { setEditing(item.id); setEntry({ title: item.title, itemId: item.referenceCode || item.itemId || "", affiliateUrl: item.affiliateUrl }); document.getElementById("collection-title")?.scrollIntoView(); }}>Editar</button><button disabled={busy} className="button outline" onClick={() => void save({ action: "toggle", id: item.id, active: !item.isActive })}>{item.isActive ? "Pausar" : "Retomar"}</button><button disabled={busy} className="button outline" onClick={() => setRemoving(item.id)}>Remover</button></div>{removing === item.id && <div><p>Remover este produto da coleção?</p><button disabled={busy} className="button outline" onClick={() => void save({ action: "remove", id: item.id })}>Confirmar remoção</button><button className="button outline" onClick={() => setRemoving("")}>Cancelar</button></div>}</article>)}</div>
  </section>;
}
