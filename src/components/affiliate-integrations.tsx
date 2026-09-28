"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, KeyRound, LoaderCircle, Save, ShieldCheck, Store } from "lucide-react";

type Provider = "aliexpress" | "amazon" | "awin" | "shopee" | "magalu" | "mercadolivre";
type Field = { key: string; label: string; type?: "password" | "url" | "textarea"; optional?: boolean; hint?: string };
type Definition = { provider: Provider; name: string; mark: string; tone: string; fields: Field[]; note?: string; helpUrl: string };

const definitions: Definition[] = [
  { provider: "aliexpress", name: "AliExpress", mark: "AX", tone: "red", helpUrl: "https://portals.aliexpress.com/", fields: [{ key: "appKey", label: "App Key" }, { key: "secret", label: "Secret", type: "password" }, { key: "trackingId", label: "Tracking ID" }] },
  { provider: "amazon", name: "Amazon", mark: "A", tone: "amber", helpUrl: "https://associados.amazon.com.br/", note: "A API oficial da Amazon exige credenciais próprias do programa de associados.", fields: [{ key: "affiliateId", label: "Affiliate ID" }, { key: "accessKey", label: "Access Key", type: "password" }, { key: "secretKey", label: "Secret Key", type: "password" }] },
  { provider: "awin", name: "AWIN", mark: "AW", tone: "navy", helpUrl: "https://ui.awin.com/", fields: [{ key: "affiliateId", label: "Afiliado ID" }, { key: "apiToken", label: "API Token", type: "password" }] },
  { provider: "shopee", name: "Shopee", mark: "S", tone: "orange", helpUrl: "https://affiliate.shopee.com.br/", note: "Se sua conta não tiver senha de API, informe apenas o ID de afiliado.", fields: [{ key: "affiliateId", label: "ID de afiliado" }, { key: "apiPassword", label: "Senha API", type: "password", optional: true }] },
  { provider: "magalu", name: "Magalu", mark: "M", tone: "blue", helpUrl: "https://www.magazinevoce.com.br/", fields: [{ key: "storeName", label: "Nome da loja" }] },
  { provider: "mercadolivre", name: "Mercado Livre", mark: "ML", tone: "yellow", helpUrl: "https://www.mercadolivre.com.br/afiliados", note: "Use somente dados da sua própria conta. Cookies podem expirar e precisar de atualização.", fields: [{ key: "affiliateLink", label: "Link de afiliado", type: "url", hint: "URL completa iniciada por https://" }, { key: "cookie", label: "Cookie do Mercado Livre", type: "textarea" }] },
];

export function AffiliateIntegrations() {
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState("");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<"loading" | "ready" | "locked" | "unavailable">("loading");

  const loadStatus = useCallback(() => {
    let active = true;
    setAvailability("loading");
    void fetch("/api/integrations/affiliates", { cache: "no-store" }).then(async response => {
      if (response.status === 401) throw new Error("locked");
      if (!response.ok) throw new Error("unavailable");
      return response.json() as Promise<{ integrations: { provider: string; status: string }[]; encryptionReady: boolean }>;
    }).then(result => {
      if (!active) return;
      setConfigured(new Set(result.integrations.filter(item => item.status === "configured").map(item => item.provider)));
      setAvailability(result.encryptionReady ? "ready" : "unavailable");
    }).catch(error => { if (active) setAvailability(error instanceof Error && error.message === "locked" ? "locked" : "unavailable"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancel = loadStatus();
    const reload = () => { cancel(); cancel = loadStatus(); };
    window.addEventListener("ofertou:setup-authorized", reload);
    return () => { cancel(); window.removeEventListener("ofertou:setup-authorized", reload); };
  }, [loadStatus]);

  function update(provider: string, key: string, value: string) {
    setValues(current => ({ ...current, [provider]: { ...current[provider], [key]: value } }));
  }

  async function save(definition: Definition, event: React.FormEvent) {
    event.preventDefault();
    setSaving(definition.provider);
    setMessages(current => ({ ...current, [definition.provider]: "" }));
    const credentials = Object.fromEntries(definition.fields.map(field => [field.key, values[definition.provider]?.[field.key] ?? ""]));
    try {
      const response = await fetch("/api/integrations/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: definition.provider, credentials }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        const errors: Record<string, string> = { unauthorized: "Acesse primeiro a conexão protegida do WhatsApp.", forbidden: "Origem do site recusada.", encryption_not_configured: "Configure INTEGRATIONS_ENCRYPTION_KEY no servidor.", invalid_credentials: "Revise os campos obrigatórios.", save_failed: "Não foi possível salvar no banco." };
        throw new Error(errors[result.error ?? ""] ?? "Não foi possível salvar a integração.");
      }
      setConfigured(current => new Set(current).add(definition.provider));
      setValues(current => ({ ...current, [definition.provider]: {} }));
      setMessages(current => ({ ...current, [definition.provider]: "Credenciais criptografadas e salvas." }));
    } catch (error) {
      setMessages(current => ({ ...current, [definition.provider]: error instanceof Error ? error.message : "Falha ao acessar o servidor." }));
    } finally { setSaving(""); }
  }

  return <section className="affiliate-section" aria-labelledby="affiliate-title">
    <div className="affiliate-heading"><div><span className="tiny-label">PROGRAMAS DE AFILIADOS</span><h2 id="affiliate-title">Credenciais das plataformas</h2><p>Salve os acessos oficiais para preparar as próximas integrações de produtos e links.</p></div><span className="secure-badge"><ShieldCheck size={16}/> Criptografia no servidor</span></div>
    {availability === "locked" && <div className="affiliate-warning" role="alert"><KeyRound size={18}/><div><strong>Acesso protegido necessário</strong><p>Use a chave de configuração no cartão do WhatsApp para liberar o gerenciamento das integrações.</p></div></div>}
    {availability === "unavailable" && <div className="affiliate-warning" role="alert"><KeyRound size={18}/><div><strong>Armazenamento seguro indisponível</strong><p>Configure <code>INTEGRATIONS_ENCRYPTION_KEY</code> no serviço Ofertou e acesse novamente a conexão protegida.</p></div></div>}
    <div className="affiliate-grid">{definitions.map(definition => <form className="affiliate-card" key={definition.provider} onSubmit={event => void save(definition, event)}>
      <header><span className={`affiliate-mark ${definition.tone}`} aria-hidden="true">{definition.mark}</span><div><h3>Afiliados {definition.name}</h3><span className={`integration-state ${configured.has(definition.provider) ? "configured" : ""}`}>{configured.has(definition.provider) ? <><Check size={12}/> Configurado</> : "Não configurado"}</span></div></header>
      <div className="affiliate-card-body">{definition.note && <div className="provider-note"><Store size={17}/><span>{definition.note}</span></div>}
        {definition.fields.map(field => <label className="field" key={field.key}>{field.label}{field.optional && <small>Opcional</small>}{field.type === "textarea" ? <textarea rows={4} autoComplete="off" value={values[definition.provider]?.[field.key] ?? ""} onChange={event => update(definition.provider, field.key, event.target.value)} required={!field.optional}/> : <input type={field.type ?? "text"} autoComplete="off" value={values[definition.provider]?.[field.key] ?? ""} onChange={event => update(definition.provider, field.key, event.target.value)} required={!field.optional}/>} {field.hint && <span className="field-hint">{field.hint}</span>}</label>)}
        {messages[definition.provider] && <p className={`affiliate-feedback ${messages[definition.provider].includes("salvas") ? "success" : "error"}`} role="status">{messages[definition.provider]}</p>}
      </div>
      <footer><div className="affiliate-save"><button className="button primary" type="submit" disabled={availability !== "ready" || saving === definition.provider}>{saving === definition.provider ? <><LoaderCircle className="spin" size={16}/> Salvando...</> : <><Save size={16}/> Salvar</>}</button>{availability === "locked" && <small>Libere o acesso no cartão do WhatsApp acima.</small>}{availability === "unavailable" && <small>Armazenamento seguro indisponível.</small>}{availability === "loading" && <small>Verificando acesso...</small>}</div><a href={definition.helpUrl} target="_blank" rel="noreferrer">Ajuda oficial <ExternalLink size={14}/></a></footer>
    </form>)}</div>
    <p className="affiliate-disclaimer">Salvar credenciais não confirma conexão com a plataforma nem ativa geração automática de links. Cada provedor será habilitado somente após implementação e validação do contrato oficial correspondente.</p>
  </section>;
}
