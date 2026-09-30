"use client";
import { useState } from "react";
import type { RealProduct } from "@/lib/integrations/mercadolivre-products";

const errors: Record<string, string> = {
  unauthorized: "Libere a consulta com a chave de produtos. O acesso dura 15 minutos.",
  access_not_configured: "Configure MERCADO_LIVRE_PRODUCTS_TOKEN no servidor com uma chave aleatória de pelo menos 32 caracteres.",
  invalid_request: "Informe um ID de anúncio válido, por exemplo MLB1234567890.",
  reconnect_required: "Reconecte sua conta do Mercado Livre em Integrações.",
  refresh_busy: "A renovação está em andamento. Aguarde alguns segundos e consulte novamente. Se persistir, reconecte sua conta.",
  permission_denied: "O Mercado Livre não autorizou esta consulta. Confira as permissões da aplicação e do anúncio.",
  not_found: "Anúncio não encontrado.", rate_limited: "Limite de consultas atingido. Aguarde antes de tentar novamente.",
  token_rejected: "O Mercado Livre recusou o acesso. Reconecte a conta.",
};
export function MercadoLivreProducts() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [itemId, setItemId] = useState("");
  const [products, setProducts] = useState<RealProduct[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: "unlock" | "query", offset = 0, own = false) {
    setBusy(true); setMessage("");
    if (action === "query") { setProducts([]); setNext(null); }
    try {
      const response = await fetch("/api/integrations/mercadolivre/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "unlock" ? { action, token: key } : { action, offset, ...(!own && itemId.trim() ? { itemId: itemId.trim().toUpperCase() } : {}) }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 401) setUnlocked(false); throw new Error(errors[result.error] ?? "Consulta indisponível. Tente novamente em instantes."); }
      if (action === "unlock") { setUnlocked(true); setKey(""); setMessage("Consulta liberada por 15 minutos."); }
      else { setProducts(result.products); setNext(result.nextOffset); setMessage(result.products.length ? "Dados consultados agora na API oficial. O link do anúncio não garante comissão de afiliado." : "Nenhum anúncio encontrado na conta conectada. Você também pode consultar um anúncio pelo ID MLB."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de rede."); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="ml-products-title">
    <h2 id="ml-products-title">Produtos reais · Mercado Livre</h2>
    <p>Consulte um anúncio pelo ID ou liste os anúncios da sua conta vendedora. Esta consulta não é uma busca geral de ofertas de afiliados.</p>
    {!unlocked ? <form onSubmit={event => { event.preventDefault(); void run("unlock"); }}><label className="field">Chave de consulta de produtos<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required minLength={32}/></label><button className="button primary" disabled={busy}>Liberar consulta</button></form> : <form onSubmit={event => { event.preventDefault(); void run("query"); }}><label className="field">ID do anúncio<input value={itemId} onChange={event => setItemId(event.target.value)} placeholder="MLB1234567890" pattern="[Mm][Ll][Bb][0-9]{6,20}" required/></label><div className="editor-actions"><button className="button primary" disabled={busy}>Consultar anúncio</button><button type="button" className="button outline" disabled={busy} onClick={() => void run("query", 0, true)}>Listar anúncios da minha conta</button></div></form>}
    <p role="status">{busy ? "Consultando o Mercado Livre…" : message}</p>
    <div className="product-grid">{products.map(product => <article className="panel" key={product.id}><small>{product.id} · {product.status}</small><h3>{product.title}</h3><p>{product.price === null ? "Preço indisponível" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: product.currency }).format(product.price)}</p>{product.url && <a className="button outline" href={product.url} target="_blank" rel="noreferrer">Abrir anúncio</a>}</article>)}</div>
    {next !== null && <button className="button outline" disabled={busy} onClick={() => void run("query", next, true)}>Próxima página</button>}
  </section>;
}
