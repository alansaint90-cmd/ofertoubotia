"use client";
import { useState } from "react";
import Image from "next/image";
import { safeProductImage, type ProductDetails } from "@/lib/integrations/product-review";

export function CollectionProductReview({ id, title, link, details, onSaved }: { id: string; title: string; link: string; details?: Partial<ProductDetails>; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(details?.title ?? title);
  const [price, setPrice] = useState(details?.price?.toString() ?? "");
  const [imageUrl, setImageUrl] = useState(details?.imageUrl ?? "");
  const [description, setDescription] = useState(details?.description ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState(details?.source ?? "manual");
  const [imageFailed, setImageFailed] = useState(false);
  function edit() { setConfirmed(false); setSource("manual"); }
  async function submit(action: "resolve" | "review") {
    setBusy(true); setMessage(""); setOpen(true);
    try {
      const response = await fetch("/api/integrations/mercadolivre/products/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, ...(action === "review" ? { details: { title: name, price: Number(price), imageUrl, description, confirmed } } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "resolve") {
        const value: ProductDetails = result.item.details;
        setName(value.title); setPrice(value.price?.toString() ?? ""); setImageUrl(value.imageUrl); setDescription(value.description); setSource("api"); setConfirmed(false); setImageFailed(false);
        setMessage(`Dados consultados na API. Estado do anúncio: ${value.status}. Confira a prévia antes de confirmar.`);
      } else setMessage("Dados revisados e salvos. Nenhuma mensagem foi enviada.");
      await onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de rede."); }
    finally { setBusy(false); }
  }
  return <div>
    <p>{details?.reviewedAt ? "Dados revisados" : "Revisão pendente"}{details?.source ? ` · ${details.source === "api" ? "Consulta API" : "Preenchimento manual"}` : ""}</p>
    <div className="editor-actions"><button className="button outline" disabled={busy} onClick={() => void submit("resolve")}>Identificar pelo link</button><button className="button outline" disabled={busy} onClick={() => setOpen(!open)}>{open ? "Fechar prévia" : "Preencher e revisar"}</button></div>
    <p role="status">{busy ? "Processando…" : message}</p>
    {open && <form onSubmit={event => { event.preventDefault(); void submit("review"); }}>
      <p>{source === "api" ? "Dados obtidos na API, sujeitos a mudanças de preço." : "Dados manuais: confira o anúncio. O preço não será atualizado automaticamente."}</p>
      <label className="field">Título da oferta<input required maxLength={200} value={name} onChange={event => { setName(event.target.value); edit(); }}/></label>
      <label className="field">Preço em reais<input type="number" required min="0.01" max="10000000" step="0.01" value={price} onChange={event => { setPrice(event.target.value); edit(); }}/></label>
      <label className="field">URL da foto do produto<input type="url" required maxLength={2000} value={imageUrl} onChange={event => { setImageUrl(event.target.value); setImageFailed(false); edit(); }}/><span>Abra a foto do anúncio e copie o endereço da imagem HTTPS hospedada em mlstatic.com.</span></label>
      <label className="field">Texto complementar<textarea maxLength={1500} rows={3} value={description} onChange={event => { setDescription(event.target.value); edit(); }}/></label>
      <div className="panel" aria-label="Prévia da oferta"><h4>Prévia para revisão</h4>
        {safeProductImage(imageUrl) && !imageFailed ? <Image unoptimized width={400} height={260} src={imageUrl} alt={name || "Foto do produto"} referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: 260, objectFit: "contain" }} onError={() => setImageFailed(true)}/> : <p>Foto indisponível. Confira o endereço da imagem.</p>}
        <strong>{name || "Título da oferta"}</strong><p>{Number(price) > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(price)) : "Informe o preço"}</p><p style={{ whiteSpace: "pre-wrap" }}>{description}</p><a href={link} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{link}</a>
      </div>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/> Conferi foto, preço, título e destino do link na prévia.</label>
      <button className="button primary" disabled={busy || !confirmed || imageFailed || !safeProductImage(imageUrl)}>Confirmar revisão e salvar</button>
    </form>}
  </div>;
}
