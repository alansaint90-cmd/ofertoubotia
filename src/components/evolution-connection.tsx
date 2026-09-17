"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Image from "next/image";

type State = "idle" | "locked" | "ready" | "loading" | "unavailable";
type Connection = { state: "open" | "connecting" | "close" | "unknown"; qr: string | null };
type AuthorizedGroup = { id: string; name: string; externalGroupId: string };

export function EvolutionConnection() {
  const [mode, setMode] = useState<State>("idle");
  const [connection, setConnection] = useState<Connection>({ state: "unknown", qr: null });
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [group, setGroup] = useState<AuthorizedGroup | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [binding, setBinding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/evolution", { cache: "no-store" });
      if (response.status === 401) { setMode("locked"); return; }
      if (response.status === 503) { setMode("unavailable"); return; }
      if (!response.ok) throw new Error();
      const result = await response.json() as Connection;
      setConnection(current => ({ state: result.state, qr: result.state === "open" ? null : current.qr }));
      setMode("ready"); setMessage("");
    } catch { setMode("ready"); setMessage("Não foi possível consultar a Evolution API. Verifique a URL, a chave e a instância no servidor."); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (mode !== "ready" || connection.state === "open") return;
    const timer = window.setInterval(() => { void refresh(); }, 10000);
    return () => window.clearInterval(timer);
  }, [mode, connection.state, refresh]);
  useEffect(() => {
    if (mode !== "ready" || connection.state !== "open") return;
    let active = true;
    void fetch("/api/integrations/evolution/group", { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ group: AuthorizedGroup | null }>; })
      .then(result => { if (active) setGroup(result.group); })
      .catch(() => { if (active) setMessage("O grupo ainda não pode ser consultado. Verifique o banco e EVOLUTION_WORKSPACE_ID."); });
    return () => { active = false; };
  }, [mode, connection.state]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setMode("loading"); setMessage("");
    try {
      const response = await fetch("/api/integrations/evolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", token }) });
      if (!response.ok) { setMode("locked"); setMessage(response.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Chave de configuração inválida."); return; }
      setToken(""); await refresh();
    } catch { setMode("locked"); setMessage("Falha ao acessar o servidor."); }
  }

  async function connect() {
    setMode("loading"); setMessage("");
    try {
      const response = await fetch("/api/integrations/evolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect" }) });
      if (response.status === 401) { setMode("locked"); return; }
      if (!response.ok) throw new Error();
      const result = await response.json() as Connection;
      setConnection(result); setMode("ready");
      if (result.state !== "open" && !result.qr) setMessage("A instância ainda não retornou QR Code. Aguarde e tente novamente.");
    } catch { setMode("ready"); setMessage("Não foi possível obter o QR Code. Confira se a instância existe e se a Evolution API está acessível."); }
  }

  async function bindGroup(event: React.FormEvent) {
    event.preventDefault(); setBinding(true); setMessage("");
    try {
      const response = await fetch("/api/integrations/evolution/group", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: inviteLink }) });
      const result = await response.json() as { group?: AuthorizedGroup; error?: string };
      if (!response.ok || !result.group) {
        const errors: Record<string, string> = { wrong_group: "Este não é o grupo autorizado.", whatsapp_not_connected: "Conecte o WhatsApp antes de selecionar o grupo.", not_group_member: "O número conectado não participa deste grupo.", group_lookup_failed: "Não foi possível identificar o grupo pelo convite.", group_save_failed: "Não foi possível salvar o grupo. Verifique o banco e o workspace." };
        setMessage(errors[result.error ?? ""] ?? "Falha ao ativar o grupo."); return;
      }
      setGroup(result.group); setInviteLink(""); setMessage("Grupo autorizado. Ofertas revisadas poderão ser enfileiradas pelo botão Publicar.");
    } catch { setMessage("Falha ao acessar o servidor."); }
    finally { setBinding(false); }
  }

  const connected = connection.state === "open" && mode === "ready";
  return <div className="integration-card evolution-card">
    <div className="integration-logo whatsapp"><MessageCircle size={29}/></div>
    <span className={`status ${connected ? "active" : "inactive"}`}>{connected ? "Conectado" : connection.state === "connecting" ? "Conectando" : "Não conectado"}</span>
    <h3>WhatsApp</h3>
    <p>Consulte a instância da Evolution API e conecte seu aparelho pelo QR Code.</p>
    {mode === "idle" && <p>Consultando integração...</p>}
    {mode === "unavailable" && <div className="evolution-message">Configure EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME e EVOLUTION_SETUP_TOKEN no servidor do Ofertou.</div>}
    {mode === "locked" && <form className="evolution-login" onSubmit={login}>
      <label className="field">Chave de configuração<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} required placeholder="Chave definida no servidor"/></label>
      <button className="button outline" type="submit"><ShieldCheck size={15}/> Acessar conexão</button>
    </form>}
    {(mode === "ready" || mode === "loading") && <>
      {connected && <div className="evolution-message success">Instância conectada ao WhatsApp.</div>}
      {connected && group && <div className="evolution-message success"><strong>Grupo autorizado:</strong> {group.name}<br/><small>{group.externalGroupId}</small></div>}
      {connected && !group && <form className="evolution-login" onSubmit={bindGroup}><label className="field">Link do único grupo autorizado<input type="url" value={inviteLink} onChange={event => setInviteLink(event.target.value)} required placeholder="https://chat.whatsapp.com/..."/></label><button className="button outline" type="submit" disabled={binding}>{binding ? "Verificando..." : "Autorizar este grupo"}</button></form>}
      {connection.qr && !connected && <div className="evolution-qr"><Image unoptimized src={connection.qr} alt="QR Code para conectar o WhatsApp" width={230} height={230}/><p>No WhatsApp do celular, abra Aparelhos conectados e escaneie este código.</p></div>}
      <div className="integration-foot"><span>{connected ? "Estado confirmado pela Evolution API" : "Conecte para autorizar o grupo"}</span><div className="evolution-actions"><button className="button outline" disabled={mode === "loading"} onClick={() => void refresh()}><RefreshCw size={15}/> Atualizar</button>{!connected && <button className="button outline" disabled={mode === "loading"} onClick={() => void connect()}>{connection.qr ? "Novo QR Code" : "Conectar"}</button>}</div></div>
    </>}
    {message && <div className="evolution-message error" role="alert">{message}</div>}
  </div>;
}
