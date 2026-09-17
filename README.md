# Ofertou

Interface de demonstração do Ofertou, um SaaS para organizar ofertas de afiliados.

## Executar

Requer Node.js 24 e pnpm. Execute `pnpm install` e `pnpm dev`, então abra `http://localhost:3000`. Para verificar: `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`.

O modo demo apresenta produtos, grupos, editor de oferta, agendamento local, histórico visual, perfil, central de ajuda e relatórios básicos. Não envia mensagens e não gera links afiliados reais. Ofertas, agendamentos e dados do perfil ficam neste navegador. Os relatórios usam apenas esses registros locais; cliques, vendas e comissões não estão disponíveis. O esquema PostgreSQL e as migrations já estão em `src/lib/db`, mas a interface demo ainda não utiliza o banco.

## EasyPanel (modo demonstração)

Copie o conteúdo de [`.env.easypanel.example`](.env.easypanel.example) para **App → Environment**. Configure o domínio para a porta interna `3000`. Use Node.js 24, instale as dependências com `pnpm install --frozen-lockfile`, compile com `pnpm build` e inicie com `pnpm start`. O EasyPanel aceita linhas `CHAVE=valor` e fornece essas variáveis ao build e ao contêiner.

Não é necessário configurar PostgreSQL nem inserir chaves de Shopee, Evolution API ou IA para publicar a demonstração. As variáveis adicionais de [`.env.example`](.env.example) pertencem a migrations, seed manual ou integrações futuras e não tornam o login ou os envios funcionais nesta versão.

## Seed manual de acesso local

Defina `POSTGRES_PASSWORD` e `DATABASE_URL` no ambiente, inicie PostgreSQL 16 e execute `pnpm db:migrate`. Depois defina `SEED_OWNER_EMAIL`, `SEED_OWNER_NAME`, `SEED_WORKSPACE_NAME` e `SEED_OWNER_PASSWORD` no ambiente do processo. A senha deve ter pelo menos 15 caracteres. Execute `pnpm seed:access`. Não coloque a senha no comando, em arquivos versionados ou em exemplos de documentação.

O seed cria o primeiro usuário, seu hash Argon2id, workspace e papel `owner`. Opcionalmente, `SEED_ACCESS_USERS` aceita um array JSON de até três objetos com `email`, `name`, `password` e `role` (`admin`, `operador` ou `visualizador`). Cada senha deve ter pelo menos 15 caracteres. O primeiro dono só pode ser criado em um banco sem contas; ao repetir o seed, senhas e papéis existentes não são alterados. O seed não habilita login na interface. Consulte [regras-negocio.md](docs/regras-negocio.md) para os controles ainda pendentes.

## Identidade visual

Paleta fornecida: `#FF5E2B`, `#FF8C42`, `#FFDAA5`, `#1A1A1A`, `#F2F2F2`. Tipografia: Manrope nos títulos e DM Sans na interface, com fallback de sistema.

## Próximos módulos de produção

Autenticação, PostgreSQL/Drizzle, RLS, adapters oficiais, Redis/BullMQ, worker, auditoria e testes de integração. Veja [architecture.md](docs/architecture.md) e [regras-negocio.md](docs/regras-negocio.md).
