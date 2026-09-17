"use client";

import { useState } from "react";
import { CalendarDays, ChartNoAxesCombined, Clock3, Layers3, Users } from "lucide-react";
import { buildDemoReport, type ReportRange } from "@/lib/reports";
import type { Group, Offer, Product } from "@/lib/demo";

export function ReportsPage({ offers, groups, products, onFindProduct }: { offers: Offer[]; groups: Group[]; products: Product[]; onFindProduct: () => void }) {
  const [range, setRange] = useState<ReportRange>("30d");
  const report = buildDemoReport(offers, groups, products, range);
  const maxDay = Math.max(1, ...report.daily.map(day => day.count));
  return <div className="reports-page">
    <div className="local-notice"><ChartNoAxesCombined size={18}/><p>Relatório local de demonstração. Os números vêm das ofertas salvas neste navegador; cliques, vendas e comissões ainda não estão disponíveis.</p></div>
    <div className="report-toolbar"><div><strong>Período</strong><span>Data de criação das ofertas</span></div><div className="range-tabs" role="group" aria-label="Período do relatório"><button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>7 dias</button><button className={range === "30d" ? "active" : ""} onClick={() => setRange("30d")}>30 dias</button><button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>Todo o período</button></div></div>
    <div className="report-metrics"><ReportMetric icon={Layers3} label="Ofertas criadas" value={report.total}/><ReportMetric icon={Clock3} label="Rascunhos" value={report.drafts}/><ReportMetric icon={CalendarDays} label="Agendadas" value={report.scheduled}/><ReportMetric icon={Users} label="Grupos ativos" value={report.activeGroups}/></div>
    {report.total === 0 ? <div className="panel report-empty"><ChartNoAxesCombined size={29}/><h2>Ainda não há ofertas neste período</h2><p>Crie uma oferta para começar a acompanhar sua operação aqui.</p><button className="button primary" onClick={onFindProduct}>Buscar produtos</button></div> : <div className="report-grid">
      <section className="panel report-chart"><div className="panel-heading"><div><h2>Ofertas criadas</h2><p>{range === "all" ? "Selecione 7 ou 30 dias para ver a evolução diária." : "Evolução diária no período selecionado"}</p></div></div>{range === "all" ? <div className="chart-placeholder">Use um período de 7 ou 30 dias para visualizar o gráfico.</div> : <div className="daily-chart" aria-label="Gráfico de ofertas criadas por dia">{report.daily.map(day => <div className="day-column" key={day.label} title={`${day.label}: ${day.count} oferta(s)`}><span className="bar-track"><span className="bar-fill" style={{ height: `${Math.max(day.count ? 8 : 0, day.count / maxDay * 100)}%` }}/></span><small>{range === "7d" ? day.label : day.label.slice(0, 2)}</small></div>)}</div>}</section>
      <section className="panel report-ranking"><div className="panel-heading"><div><h2>Produtos mais usados</h2><p>Quantidade de ofertas criadas</p></div></div>{report.productRanking.map((item, index) => <div className="ranking-row" key={item.id}><span>{index + 1}</span><strong>{item.name}</strong><b>{item.count}</b></div>)}</section>
      <section className="panel report-ranking"><div className="panel-heading"><div><h2>Grupos selecionados</h2><p>Quantas ofertas foram associadas a cada grupo</p></div></div>{report.groupRanking.length ? report.groupRanking.map((item, index) => <div className="ranking-row" key={item.id}><span>{index + 1}</span><strong>{item.name}</strong><b>{item.count}</b></div>) : <p className="report-no-data">Nenhum grupo selecionado nas ofertas deste período.</p>}</section>
    </div>}
  </div>;
}

function ReportMetric({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: number }) {
  return <div className="metric-card"><span className="metric-icon orange"><Icon size={19}/></span><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">Dados deste navegador</div></div>;
}
