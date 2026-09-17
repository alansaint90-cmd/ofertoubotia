"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Row = { id: string; headline: string; groupName: string; status: string; createdAt: string; sentAt: string | null };
const labels: Record<string, string> = { queued: "Na fila", processing: "Processando", accepted: "Aceito pela Evolution", failed: "Falhou", uncertain: "Resultado incerto" };

export function LiveHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("Carregando envios...");
  async function refresh() {
    try {
      const response = await fetch("/api/dispatches", { cache: "no-store" });
      if (response.status === 401) { setMessage("Acesse a conexão do WhatsApp em Integrações para consultar os envios."); return; }
      if (!response.ok) throw new Error();
      const result = await response.json() as { dispatches: Row[] };
      setRows(result.dispatches); setMessage(result.dispatches.length ? "" : "Nenhuma publicação real foi enfileirada.");
    } catch { setMessage("Não foi possível consultar o histórico real."); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);
  return <section className="panel table-panel"><div className="panel-heading"><div><h2>Publicações reais</h2><p>Últimos 20 envios para o grupo autorizado.</p></div><button className="button outline" onClick={() => void refresh()}><RefreshCw size={15}/> Atualizar</button></div>
    {rows.length ? <div className="table-wrap"><table><thead><tr><th>Oferta</th><th>Grupo</th><th>Solicitado em</th><th>Estado</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.headline}</strong></td><td>{row.groupName}</td><td>{new Date(row.createdAt).toLocaleString("pt-BR")}</td><td>{labels[row.status] ?? row.status}</td></tr>)}</tbody></table></div> : <p className="history-message">{message}</p>}
    <p className="history-caption">“Aceito pela Evolution” confirma a aceitação pela API; a entrega aos participantes ainda não é rastreada aqui.</p>
  </section>;
}
