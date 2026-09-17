"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, CircleHelp, Copy, ExternalLink, History, LayoutDashboard, Link2, Menu, MessageCircle, MoreHorizontal, Plus, Search, Settings, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Star, Users, WandSparkles, X, Zap } from "lucide-react";
import { discount, initialGroups, makeCopy, money, products, type Group, type Offer, type Product } from "@/lib/demo";
import { demoProfileSchema, emptyDemoProfile, type DemoProfile } from "@/lib/demo-profile";
import { ProfilePage } from "@/components/profile-page";
import { ReportsPage } from "@/components/reports-page";
import { HelpPage } from "@/components/help-page";

const nav = [
  { path: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { path: "/products", label: "Buscar produtos", icon: Search },
  { path: "/offers", label: "Minhas ofertas", icon: ShoppingBag },
  { path: "/schedules", label: "Agendamentos", icon: CalendarDays },
  { path: "/groups", label: "Grupos WhatsApp", icon: Users },
  { path: "/templates", label: "Templates", icon: WandSparkles },
  { path: "/integrations", label: "Integrações", icon: Link2 },
  { path: "/history", label: "Histórico", icon: History },
  { path: "/reports", label: "Relatórios", icon: ChartNoAxesCombined },
];
const headings: Record<string, [string, string]> = {
  "/dashboard": ["Visão geral", "Sua operação de afiliados em um só lugar."],
  "/products": ["Encontre sua próxima oferta", "Explore produtos e transforme oportunidades em publicações."],
  "/offers": ["Minhas ofertas", "Organize as ofertas que você criou."],
  "/schedules": ["Agendamentos", "Acompanhe o que está planejado para os seus grupos."],
  "/groups": ["Grupos WhatsApp", "Escolha onde suas ofertas serão publicadas."],
  "/templates": ["Templates de mensagem", "Comece com um formato e personalize sua copy."],
  "/integrations": ["Integrações", "Conecte os canais da sua operação."],
  "/history": ["Histórico", "Veja o andamento das publicações."],
  "/settings": ["Configurações", "Preferências do seu espaço de trabalho."],
  "/reports": ["Relatórios", "Acompanhe as ofertas registradas neste navegador."],
  "/profile": ["Meus dados", "Personalize seu perfil de demonstração."],
  "/help": ["Central de ajuda", "Encontre respostas para usar o Ofertou."],
};

function useRoute() {
  const [route, setRoute] = useState("/dashboard");
  useEffect(() => {
    const sync = () => setRoute(window.location.pathname === "/" ? "/dashboard" : window.location.pathname);
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const go = (path: string) => { window.history.pushState({}, "", path); setRoute(path.split("?")[0]); window.scrollTo(0, 0); };
  return { route, go };
}

function ProductVisual({ product, large = false }: { product: Product; large?: boolean }) {
  return <div className={`product-visual ${product.color} ${large ? "large" : ""}`}><span className="visual-orb"/><span className="product-emoji">{product.icon}</span><span className="visual-line one"/><span className="visual-line two"/></div>;
}

function ProductCard({ product, onDetails, onCreate }: { product: Product; onDetails: () => void; onCreate: () => void }) {
  return <article className="product-card">
    <div className="product-image-wrap"><ProductVisual product={product}/><span className="discount-badge">-{discount(product)}%</span></div>
    <div className="product-card-body"><div className="tiny-label">{product.category} · Demo</div><h3>{product.name}</h3><div className="price-row"><strong>{money(product.price)}</strong><del>{money(product.oldPrice)}</del></div>
      <div className="product-meta"><span><Star size={14} fill="currentColor"/> {product.rating}</span><span>+{product.sold} vendidos</span></div>
      <div className="product-card-actions"><button className="text-button" onClick={onDetails}>Ver detalhes</button><button className="small-primary" onClick={onCreate}>Criar oferta <ArrowRight size={15}/></button></div>
    </div>
  </article>;
}

function EmptyState({ icon: Icon, title, text, action, onAction }: { icon: typeof ShoppingBag; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={26}/></div><h3>{title}</h3><p>{text}</p>{action && <button className="button primary" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>;
}

export function App() {
  const { route, go } = useRoute();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState("Relevância");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(["casa"]);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [style, setStyle] = useState("Achadinho");
  const [scheduledAt, setScheduledAt] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [settings, setSettings] = useState({ workspace: "Meu workspace", interval: "60", timezone: "America/Sao_Paulo" });
  const [profile, setProfile] = useState<DemoProfile>(emptyDemoProfile);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedOffers = localStorage.getItem("ofertou-demo-offers");
        const savedGroups = localStorage.getItem("ofertou-demo-groups");
        const savedSettings = localStorage.getItem("ofertou-demo-settings");
        const savedProfile = localStorage.getItem("ofertou-demo-profile");
        if (savedOffers) setOffers(JSON.parse(savedOffers));
        if (savedGroups) setGroups(JSON.parse(savedGroups));
        if (savedSettings) setSettings(JSON.parse(savedSettings));
        if (savedProfile) {
          const parsedProfile = demoProfileSchema.safeParse(JSON.parse(savedProfile));
          if (parsedProfile.success) setProfile(parsedProfile.data);
        }
      } catch { /* Dados de demonstração inválidos são ignorados. */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("ofertou-demo-offers", JSON.stringify(offers)); }, [offers, ready]);
  useEffect(() => { if (ready) localStorage.setItem("ofertou-demo-groups", JSON.stringify(groups)); }, [groups, ready]);
  useEffect(() => { if (ready) localStorage.setItem("ofertou-demo-settings", JSON.stringify(settings)); }, [settings, ready]);
  useEffect(() => { if (ready && profile.firstName) localStorage.setItem("ofertou-demo-profile", JSON.stringify(profile)); }, [profile, ready]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }, [notice]);

  const productId = route.startsWith("/products/") ? route.split("/")[2] : route === "/offers/new" ? new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("product") : null;
  const currentProduct = products.find(p => p.id === productId) ?? products[0];
  const activePage = route.startsWith("/products/") ? "/products" : route.startsWith("/offers/") ? "/offers" : route;
  const title = route === "/offers/new" ? ["Criar oferta", "Ajuste sua mensagem e escolha como publicar."] : route.startsWith("/products/") ? ["Detalhes do produto", "Confira os dados antes de criar sua oferta."] : headings[activePage] ?? headings["/dashboard"];
  const filtered = useMemo(() => {
    const list = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()) && (category === "Todas" || p.category === category));
    if (sort === "Maior desconto") return list.sort((a, b) => discount(b) - discount(a));
    if (sort === "Menor preço") return list.sort((a, b) => a.price - b.price);
    if (sort === "Maior comissão") return list.sort((a, b) => b.commission - a.commission);
    return list;
  }, [query, category, sort]);
  const startOffer = (product: Product) => {
    setHeadline(`✨ Achadinho: ${product.name}`);
    setAffiliateLink("");
    setBody(makeCopy(product, "Achadinho", ""));
    setSelectedGroups(product.category === "Tecnologia" ? ["tech"] : ["casa"]);
    go(`/offers/new?product=${product.id}`);
  };
  const generateLink = () => { setNotice("No modo demonstração, conecte uma conta de afiliado para gerar um link válido."); go("/integrations"); };
  const saveOffer = (status: Offer["status"]) => {
    if (!headline.trim() || !body.trim()) return setNotice("Preencha o título e a mensagem.");
    if (status !== "rascunho" && selectedGroups.length === 0) return setNotice("Selecione pelo menos um grupo.");
    if (status === "agendado" && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) return setNotice("Escolha uma data e hora futuras.");
    if (status === "enviado") return setNotice("O envio real exige WhatsApp conectado. Salve como rascunho enquanto a integração não estiver ativa.");
    setOffers(prev => [{ id: crypto.randomUUID(), productId: currentProduct.id, headline: headline.trim(), body: body.trim(), groupIds: selectedGroups, status, scheduledAt: status === "agendado" ? scheduledAt : undefined, createdAt: new Date().toISOString() }, ...prev]);
    setNotice(status === "agendado" ? "Agendamento salvo em demonstração. O envio real requer worker e WhatsApp conectados." : "Rascunho salvo."); go("/offers");
  };
  const toggleGroup = (id: string) => setSelectedGroups(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  const activeGroups = groups.filter(g => g.active);
  const scheduled = offers.filter(o => o.status === "agendado");
  const displayName = profile.firstName ? `${profile.firstName} ${profile.lastName}`.trim() : "Operação demo";
  const initials = profile.firstName ? `${profile.firstName[0]}${profile.lastName[0] ?? ""}`.toUpperCase() : "OD";
  const metric = (label: string, value: string, icon: typeof ShoppingBag, accent: string, sub: string) => { const Icon = icon; return <div className="metric-card"><span className={`metric-icon ${accent}`}><Icon size={20}/></span><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{sub}</div></div>; };
  const offerRows = (items: Offer[]) => <div className="table-wrap"><table><thead><tr><th>Oferta</th><th>Grupos</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>{items.map(offer => <tr key={offer.id}><td><div className="table-product"><span>{products.find(p => p.id === offer.productId)?.icon}</span><div><strong>{offer.headline}</strong><small>{products.find(p => p.id === offer.productId)?.name}</small></div></div></td><td>{offer.groupIds.map(id => groups.find(g => g.id === id)?.name).filter(Boolean).join(", ") || "—"}</td><td>{offer.scheduledAt ? new Date(offer.scheduledAt).toLocaleString("pt-BR") : new Date(offer.createdAt).toLocaleDateString("pt-BR")}</td><td><span className={`status ${offer.status}`}>{offer.status}</span></td><td><button className="icon-button" aria-label="Ver oferta" onClick={() => { setHeadline(offer.headline); setBody(offer.body); setSelectedGroups(offer.groupIds); go(`/offers/new?product=${offer.productId}`); }}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>;

  return <div className="app-shell">
    <aside className={`sidebar ${drawer ? "open" : ""}`}>
      <div className="brand" onClick={() => { go("/dashboard"); setDrawer(false); }}><span className="brand-mark"><Zap size={21} fill="currentColor"/></span><span>ofertou<span className="brand-dot">.</span></span></div>
      <div className="workspace-switch"><span className="workspace-icon">O</span><span><small>ESPAÇO DE TRABALHO</small><strong>{settings.workspace}</strong></span><ChevronDown size={15}/></div>
      <div className="nav-caption">MENU PRINCIPAL</div><nav>{nav.map(item => { const Icon = item.icon; return <button key={item.path} className={`nav-item ${activePage === item.path ? "active" : ""}`} onClick={() => { go(item.path); setDrawer(false); }}><Icon size={19}/><span>{item.label}</span>{item.path === "/schedules" && scheduled.length > 0 && <small className="nav-count">{scheduled.length}</small>}</button>; })}</nav>
      <div className="sidebar-bottom"><button className={`nav-item ${activePage === "/settings" ? "active" : ""}`} onClick={() => { go("/settings"); setDrawer(false); }}><Settings size={19}/>Configurações</button><button className={`nav-item ${activePage === "/help" ? "active" : ""}`} onClick={() => { go("/help"); setDrawer(false); }}><CircleHelp size={19}/>Ajuda e FAQ</button><button className="sidebar-profile profile-trigger" onClick={() => { go("/profile"); setDrawer(false); }}><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>Meus dados · modo demo</small></span><MoreHorizontal size={18}/></button></div>
    </aside>
    {drawer && <button className="drawer-backdrop" aria-label="Fechar menu" onClick={() => setDrawer(false)}/>}
    <div className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setDrawer(true)} aria-label="Abrir menu"><Menu size={22}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{activePage === "/dashboard" ? "Visão geral" : title[0]}</strong></div><div className="top-actions"><span className="demo-pill"><span/> Modo demonstração</span><button className="top-icon" aria-label="Notificações" onClick={() => setNotice("Nenhuma notificação no momento.")}><Bell size={19}/></button><button className="top-avatar top-profile-trigger" aria-label="Abrir meus dados" onClick={() => go("/profile")}>{initials}</button></div></header>
      <main className="content"><div className="page-title"><div><div className="eyebrow">OFERTOU / {activePage.replace("/", "").toUpperCase() || "DASHBOARD"}</div><h1>{title[0]}</h1><p>{title[1]}</p></div>{["/dashboard", "/offers"].includes(route) && <button className="button primary" onClick={() => go("/products")}><Plus size={18}/> Nova oferta</button>}</div>
      {route === "/dashboard" && <><div className="welcome-banner"><div><div className="banner-kicker"><Sparkles size={15}/> SUA OPERAÇÃO, MAIS SIMPLES</div><h2>Ofertas que trabalham<br/>por você<span>.</span></h2><p>Encontre produtos, crie conteúdo e organize publicações em poucos minutos.</p><button className="button light" onClick={() => go("/products")}>Explorar produtos <ArrowRight size={17}/></button></div><div className="banner-art"><div className="art-card art-back"><span>🔥</span><i/></div><div className="art-card art-front"><span>✨</span><div><i/><i/><i/></div></div><div className="art-circle"/></div></div><div className="demo-alert"><span className="alert-icon"><ShieldCheck size={18}/></span><div><strong>Você está no modo demonstração</strong><p>Os produtos e grupos são fictícios. Conecte suas integrações para operar com dados reais.</p></div><button onClick={() => go("/integrations")}>Ver integrações <ArrowRight size={15}/></button></div><div className="metrics">{metric("Ofertas criadas", String(offers.length), ShoppingBag, "orange", "Neste workspace")}{metric("Agendamentos", String(scheduled.length), CalendarDays, "purple", "Salvos em demonstração")}{metric("Grupos ativos", String(activeGroups.length), Users, "green", "Grupos de exemplo")}{metric("Publicações enviadas", "0", MessageCircle, "blue", "Integração necessária")}</div><div className="section-heading"><div><h2>Comece por aqui</h2><p>O caminho mais rápido para sua primeira oferta.</p></div></div><div className="quick-grid"><button className="quick-card" onClick={() => go("/products")}><span className="quick-icon orange"><Search size={22}/></span><strong>Encontre um produto</strong><small>Explore produtos de demonstração</small><ArrowRight size={18}/></button><button className="quick-card" onClick={() => go("/integrations")}><span className="quick-icon purple"><Link2 size={22}/></span><strong>Conecte integrações</strong><small>Prepare afiliados e WhatsApp</small><ArrowRight size={18}/></button><button className="quick-card" onClick={() => go("/groups")}><span className="quick-icon green"><Users size={22}/></span><strong>Organize seus grupos</strong><small>Escolha o destino das ofertas</small><ArrowRight size={18}/></button></div><div className="section-heading"><div><h2>Produtos em destaque</h2><p>Exemplos para experimentar o fluxo.</p></div><button className="section-link" onClick={() => go("/products")}>Ver todos <ArrowRight size={16}/></button></div><div className="product-grid featured">{products.slice(0, 3).map(p => <ProductCard key={p.id} product={p} onDetails={() => go(`/products/${p.id}`)} onCreate={() => startOffer(p)}/>)}</div></>}
      {route === "/products" && <><div className="search-panel"><div className="search-input"><Search size={21}/><input placeholder="Busque por nome ou categoria..." value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={17}/></button>}</div><div className="filter-row"><div className="category-tabs">{["Todas", "Casa", "Tecnologia"].map(c => <button key={c} className={category === c ? "selected" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="sort-wrap"><SlidersHorizontal size={17}/><select value={sort} onChange={e => setSort(e.target.value)}><option>Relevância</option><option>Maior desconto</option><option>Menor preço</option><option>Maior comissão</option></select></div></div></div><div className="result-line"><strong>{filtered.length} {filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}</strong><span>Catálogo demonstrativo</span></div>{filtered.length ? <div className="product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} onDetails={() => go(`/products/${p.id}`)} onCreate={() => startOffer(p)}/>)}</div> : <EmptyState icon={Search} title="Nenhum produto encontrado" text="Tente alterar sua busca ou os filtros."/>}</>}
      {route.startsWith("/products/") && <div className="detail-layout"><div className="detail-image"><ProductVisual product={currentProduct} large/></div><div className="detail-info"><div className="tiny-label">{currentProduct.category} · Produto demonstrativo</div><h2>{currentProduct.name}</h2><div className="detail-rating"><Star size={17} fill="currentColor"/> {currentProduct.rating} <span>· +{currentProduct.sold} vendidos</span></div><div className="detail-price"><del>{money(currentProduct.oldPrice)}</del><div><strong>{money(currentProduct.price)}</strong><span className="discount-badge">-{discount(currentProduct)}%</span></div></div><div className="detail-data"><div><span>Loja</span><strong>{currentProduct.store}</strong></div><div><span>Comissão estimada</span><strong>{currentProduct.commission}%</strong></div><div><span>Origem</span><strong>Catálogo demo</strong></div></div><div className="detail-note">O link de afiliado real depende da integração oficial da rede.</div><button className="button primary full" onClick={() => startOffer(currentProduct)}>Criar oferta <ArrowRight size={17}/></button><button className="button outline full" onClick={generateLink}><Link2 size={17}/> Gerar link de afiliado</button></div></div>}
      {route === "/offers/new" && <div className="editor-grid"><section className="editor-main"><div className="editor-product"><ProductVisual product={currentProduct}/><div><div className="tiny-label">PRODUTO SELECIONADO</div><strong>{currentProduct.name}</strong><span>{money(currentProduct.price)} <small>· {discount(currentProduct)}% OFF</small></span></div><button className="text-button" onClick={() => go("/products")}>Trocar</button></div><div className="panel"><div className="panel-heading"><div><span className="step-number">01</span><h2>Mensagem da oferta</h2></div><span className="optional">Personalize antes de publicar</span></div><label className="field">Título da oferta<input value={headline} maxLength={120} onChange={e => setHeadline(e.target.value)} placeholder="Ex.: Achadinho do dia"/></label><div className="field"><div className="field-top"><label htmlFor="body">Mensagem</label><div className="ai-controls"><select value={style} onChange={e => setStyle(e.target.value)}><option>Achadinho</option><option>Urgência</option><option>Minimalista</option><option>Informativa</option></select><button className="ai-button" onClick={() => { setBody(makeCopy(currentProduct, style, affiliateLink)); setNotice("Copy de demonstração gerada apenas com os dados exibidos."); }}><Sparkles size={15}/> Gerar copy</button></div></div><textarea id="body" value={body} onChange={e => setBody(e.target.value)} rows={9} placeholder="Escreva a mensagem que seu público receberá..."/><small>Você pode editar livremente. Não inclua dados que não foram verificados.</small></div><label className="field">Link de afiliado<input type="url" value={affiliateLink} onChange={e => setAffiliateLink(e.target.value)} placeholder="Cole aqui o link gerado pelo seu programa de afiliados"/></label></div><div className="panel"><div className="panel-heading"><div><span className="step-number">02</span><h2>Onde publicar</h2></div></div><div className="group-choices">{groups.map(g => <label key={g.id} className={`group-choice ${!g.active ? "disabled" : ""}`}><input type="checkbox" checked={selectedGroups.includes(g.id)} disabled={!g.active} onChange={() => toggleGroup(g.id)}/><span className="choice-avatar"><Users size={17}/></span><span><strong>{g.name}</strong><small>{g.category} · {g.members} participantes</small></span>{selectedGroups.includes(g.id) && <Check size={17}/>}</label>)}</div></div><div className="panel"><div className="panel-heading"><div><span className="step-number">03</span><h2>Publicação</h2></div></div><label className="field">Data e hora para agendar<input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}/></label><div className="editor-actions"><button className="button outline" onClick={() => saveOffer("rascunho")}>Salvar rascunho</button><button className="button outline" onClick={() => saveOffer("enviado")}>Publicar agora</button><button className="button primary" onClick={() => saveOffer("agendado")}><CalendarDays size={17}/> Agendar oferta</button></div><p className="action-note">Agendamentos no modo demo são registros locais; nenhum WhatsApp receberá mensagem.</p></div></section><aside className="preview-column"><div className="panel preview-panel"><div className="preview-header"><div><MessageCircle size={19}/><strong>Prévia da mensagem</strong></div><span>WhatsApp</span></div><div className="chat-background"><div className="chat-date">HOJE</div><div className="chat-bubble">{body || "Sua mensagem aparecerá aqui conforme você edita."}<small>18:00 ✓✓</small></div></div><div className="preview-footer"><ShieldCheck size={16}/> Visualização aproximada</div></div><div className="tip-card"><Sparkles size={20}/><strong>Uma boa oferta começa com clareza</strong><p>Mostre o preço, o benefício real e um link válido. Revise sua mensagem antes de publicar.</p></div></aside></div>}
      {route === "/offers" && <div className="panel table-panel"><div className="panel-heading"><div><h2>Todas as ofertas</h2><p>{offers.length} {offers.length === 1 ? "registro" : "registros"} neste navegador</p></div></div>{offers.length ? offerRows(offers) : <EmptyState icon={ShoppingBag} title="Sua primeira oferta começa aqui" text="Escolha um produto para criar uma mensagem e planejar sua publicação." action="Buscar produtos" onAction={() => go("/products")}/>}</div>}
      {route === "/schedules" && <div className="panel table-panel"><div className="panel-heading"><div><h2>Próximas publicações</h2><p>Agendamentos salvos neste navegador.</p></div></div>{scheduled.length ? offerRows(scheduled) : <EmptyState icon={CalendarDays} title="Nenhuma oferta agendada" text="Crie uma oferta e escolha uma data para vê-la aqui." action="Criar oferta" onAction={() => go("/products")}/>}</div>}
      {route === "/groups" && <><div className="section-heading"><div><h2>Seus grupos</h2><p>Grupos fictícios para explorar a seleção de destinos.</p></div><button className="button outline" onClick={() => go("/integrations")}><Plus size={17}/> Conectar WhatsApp</button></div><div className="group-grid">{groups.map(g => <div className="group-card" key={g.id}><div className="group-card-top"><span className="group-icon"><Users size={22}/></span><span className={`status ${g.active ? "active" : "inactive"}`}>{g.active ? "Ativo" : "Pausado"}</span></div><h3>{g.name}</h3><p>{g.category} · {g.members} participantes</p><div className="group-card-bottom"><span>Usar em ofertas</span><button className={`switch ${g.active ? "on" : ""}`} role="switch" aria-checked={g.active} aria-label={`${g.active ? "Pausar" : "Ativar"} ${g.name}`} onClick={() => setGroups(prev => prev.map(item => item.id === g.id ? { ...item, active: !item.active } : item))}><span/></button></div></div>)}</div></>}
      {route === "/integrations" && <><div className="integration-intro"><span className="intro-icon"><Link2 size={22}/></span><div><strong>Prepare o Ofertou para sua operação real</strong><p>As conexões oficiais precisam de credenciais e configuração no servidor. Nenhuma credencial é armazenada no navegador.</p></div></div><div className="integration-grid"><div className="integration-card"><div className="integration-logo shopee">S</div><span className="status inactive">Não conectado</span><h3>Shopee Afiliados</h3><p>Pesquise produtos reais e gere links oficiais do seu programa de afiliados.</p><div className="integration-foot"><span>Produtos demonstrativos disponíveis</span><button className="button outline" onClick={() => setNotice("Configure as credenciais oficiais da Shopee no servidor para ativar esta integração.")}>Configurar <ExternalLink size={15}/></button></div></div><div className="integration-card"><div className="integration-logo whatsapp"><MessageCircle size={29}/></div><span className="status inactive">Não conectado</span><h3>WhatsApp</h3><p>Conecte uma instância da Evolution API para sincronizar grupos e publicar ofertas.</p><div className="integration-foot"><span>Grupos de demonstração disponíveis</span><button className="button outline" onClick={() => setNotice("Configure a Evolution API no servidor para ativar esta integração.")}>Configurar <ExternalLink size={15}/></button></div></div></div></>}
      {route === "/history" && <div className="panel table-panel"><div className="panel-heading"><div><h2>Atividade de publicações</h2><p>Envios reais aparecerão aqui após a integração.</p></div></div><EmptyState icon={History} title="Ainda não há envios" text="Nenhuma oferta foi enviada. O modo demonstração não dispara mensagens."/></div>}
      {route === "/templates" && <div className="template-grid">{[{ title: "Achadinho", icon: "✨", body: "✨ Achadinho do dia: {{produto}}\n\nDe {{preco_anterior}} por {{preco}}\n🏷️ {{desconto}} de desconto\n\n🛒 Confira: {{link}}" }, { title: "Informativa", icon: "📋", body: "{{produto}}\n\nPreço atual: {{preco}}\nAvaliação: {{avaliacao}}\n\nVeja os detalhes: {{link}}" }, { title: "Minimalista", icon: "⚡", body: "{{produto}} — {{preco}}\n\n{{link}}" }].map(t => <div className="template-card" key={t.title}><span className="template-icon">{t.icon}</span><h3>{t.title}</h3><pre>{t.body}</pre><button className="button outline" onClick={() => { navigator.clipboard.writeText(t.body); setNotice("Template copiado."); }}><Copy size={16}/> Copiar template</button></div>)}</div>}
      {route === "/settings" && <div className="settings-panel panel"><div className="panel-heading"><div><h2>Espaço de trabalho</h2><p>Preferências desta demonstração.</p></div></div><label className="field">Nome do workspace<input value={settings.workspace} onChange={e => setSettings({ ...settings, workspace: e.target.value })}/></label><label className="field">Intervalo entre envios (segundos)<input type="number" min="30" value={settings.interval} onChange={e => setSettings({ ...settings, interval: e.target.value })}/></label><label className="field">Fuso horário<select value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })}><option value="America/Sao_Paulo">São Paulo (UTC−3)</option><option value="America/Manaus">Manaus (UTC−4)</option><option value="UTC">UTC</option></select></label><button className="button primary" onClick={() => setNotice("Preferências salvas neste navegador.")}>Salvar preferências</button></div>}
      {route === "/profile" && (ready ? <ProfilePage profile={profile} onSave={value => { setProfile(value); setNotice("Meus dados foram salvos neste navegador."); }}/> : <div className="panel">Carregando perfil...</div>)}
      {route === "/reports" && <ReportsPage offers={offers} groups={groups} products={products} onFindProduct={() => go("/products")}/>}
      {route === "/help" && <HelpPage go={go}/>}
      </main>
    </div>{notice && <div className="toast"><span><Check size={17}/></span>{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={16}/></button></div>}
  </div>;
}
