"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { browserImportSchema, type BrowserImport } from "@/lib/integrations/browser-import";

export function BrowserProductImport({ onSaved }: { onSaved: () => Promise<void> }) {
  const [product, setProduct] = useState<BrowserImport | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    function read() {
      if (!location.hash.startsWith("#ofertou-import=")) return;
      try {
        if (location.hash.length > 30000) throw new Error("Captura muito grande.");
        const parsed = browserImportSchema.safeParse(JSON.parse(decodeURIComponent(location.hash.slice(16))));
        if (!parsed.success) throw new Error("Captura inválida ou expirada. Capture novamente pela extensão.");
        setProduct(parsed.data); setConfirmed(false); setImageFailed(false); setNotice("");
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) { setNotice(e instanceof Error ? e.message : "Captura inválida."); }
    }
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  async function save() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/integrations/mercadolivre/products/collection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "browser-import", product, confirmed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProduct(null); setConfirmed(false); setNotice("Produto importado. Nenhuma mensagem enviada."); await onSaved();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Falha ao importar."); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label="Importação pelo navegador">
    <h3>Importar pela extensão</h3>
    <p>Capture um produto no Chrome e abra sua prévia aqui. O preço corresponde ao momento da captura, incluindo as condições exibidas na página.</p>
    {product && <>
      <Image unoptimized src={product.imageUrl} alt={product.title} width={320} height={220} style={{ objectFit: "contain", maxWidth: "100%" }} onError={() => setImageFailed(true)} />
      <h4>{product.title}</h4><p>{product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
      <p>{product.description}</p><p>Capturado em {new Date(product.capturedAt).toLocaleString("pt-BR")}</p>
      <p><a href={product.affiliateUrl} target="_blank" rel="noreferrer">Conferir link de afiliado</a> · <a href={product.productUrl} target="_blank" rel="noreferrer">Conferir produto</a></p>
      {imageFailed && <p role="alert">A foto não carregou. Capture novamente.</p>}
      <p>Se este link já estiver cadastrado, a confirmação atualizará seus dados. Capture novamente no navegador para obter um preço mais recente.</p>
      <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Conferi produto, foto, preço, condições de pagamento e meu link de afiliado.</label>
      <div className="editor-actions"><button className="button primary" disabled={busy || !confirmed || imageFailed} onClick={() => void save()}>Confirmar e importar</button><button className="button outline" disabled={busy} onClick={() => setProduct(null)}>Descartar</button></div>
    </>}
    <p role="status">{busy ? "Importando…" : notice}</p>
  </section>;
}
