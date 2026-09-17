"use client";

import { useState } from "react";
import { ArrowRight, CircleHelp, Search } from "lucide-react";

const questions = [
  { category: "Começando", question: "O que é o modo demonstração?", answer: "É uma versão para experimentar o fluxo do Ofertou. Produtos e grupos são fictícios; ofertas, agendamentos e dados do perfil ficam salvos apenas neste navegador." },
  { category: "Produtos", question: "Os produtos e preços são reais?", answer: "Não. O catálogo atual é demonstrativo. Produtos reais e links de afiliado dependem da integração oficial da rede." },
  { category: "Ofertas", question: "Como criar uma oferta?", answer: "Acesse Buscar produtos, escolha um item e clique em Criar oferta. Edite a mensagem, selecione grupos e salve um rascunho ou agendamento de demonstração." },
  { category: "Agendamentos", question: "Uma oferta agendada será enviada automaticamente?", answer: "Ainda não. O agendamento atual é um registro local. O envio real requer autenticação, banco de dados, worker e WhatsApp conectado." },
  { category: "Integrações", question: "Como conectar Shopee ou WhatsApp?", answer: "As telas mostram o estado das integrações, mas a conexão ainda não está ativa. Serão necessárias credenciais oficiais e configuração segura no servidor." },
  { category: "Conta", question: "Os dados em Meus Dados criam uma conta?", answer: "Não. O perfil de demonstração personaliza apenas este navegador. O hash de senhas e o seed de acessos estão preparados, mas login e sessão ainda não foram ativados." },
  { category: "Relatórios", question: "De onde vêm os números dos relatórios?", answer: "Das ofertas e dos grupos salvos neste navegador. Cliques, vendas, comissões e envios reais não aparecem enquanto as integrações não estiverem ativas." },
];

export function HelpPage({ go }: { go: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const visible = questions.filter(item => `${item.question} ${item.answer} ${item.category}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <div className="help-page"><div className="help-hero"><span><CircleHelp size={23}/></span><div><h2>Como podemos ajudar?</h2><p>Respostas rápidas sobre o que já funciona no Ofertou.</p></div></div><div className="search-input help-search"><Search size={19}/><input aria-label="Buscar na ajuda" placeholder="Busque por produtos, agendamentos, acesso..." value={query} onChange={event => setQuery(event.target.value)}/></div>
    <div className="help-layout"><section className="panel faq-panel"><div className="panel-heading"><div><h2>Perguntas frequentes</h2><p>{visible.length} {visible.length === 1 ? "resposta encontrada" : "respostas encontradas"}</p></div></div>{visible.length ? visible.map(item => <details key={item.question} className="faq-item"><summary><span>{item.question}<small>{item.category}</small></span><span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>) : <div className="faq-empty">Nenhuma resposta encontrada. Tente outro termo.</div>}</section><aside className="help-links"><div className="panel"><h3>Acessos rápidos</h3><button onClick={() => go("/products")}>Buscar produtos <ArrowRight size={16}/></button><button onClick={() => go("/reports")}>Ver relatórios <ArrowRight size={16}/></button><button onClick={() => go("/integrations")}>Ver integrações <ArrowRight size={16}/></button><button onClick={() => go("/profile")}>Meus dados <ArrowRight size={16}/></button></div><p>Esta central de ajuda é local e não envia mensagens para suporte.</p></aside></div>
  </div>;
}
