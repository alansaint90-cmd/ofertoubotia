# Ofertou

Interface de demonstração do Ofertou, um SaaS para organizar ofertas de afiliados.

## Executar

Requer Node.js 24 e pnpm. Execute `pnpm install` e `pnpm dev`, então abra `http://localhost:3000`. Para verificar: `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`.

O modo demo apresenta produtos, grupos, editor de oferta, agendamento local, histórico visual, perfil, central de ajuda e relatórios básicos. Não envia mensagens e não gera links afiliados reais. Ofertas, agendamentos e dados do perfil ficam neste navegador. Os relatórios usam apenas esses registros locais; cliques, vendas e comissões não estão disponíveis. O esquema PostgreSQL e as migrations já estão em `src/lib/db`, mas a interface demo ainda não utiliza o banco.

## EasyPanel

Copie o conteúdo de [`.env.easypanel.example`](.env.easypanel.example) para **App → Environment**, substituindo todos os marcadores. Crie serviços PostgreSQL 16 e Redis no mesmo projeto e copie as URLs internas de **Credentials**. Configure o domínio do app para a porta interna `3000`. Use Node.js 24, instale as dependências com `pnpm install --frozen-lockfile`, compile com `pnpm build` e inicie com `pnpm start`. O EasyPanel aceita linhas `CHAVE=valor` e fornece essas variáveis ao build e ao contêiner.

Se o serviço EasyPanel estiver configurado para construir com Dockerfile, use `Dockerfile` na raiz do repositório. Ele instala as dependências, compila o Next.js e inicia na porta `3000`. O build não precisa de credenciais: a `.dockerignore` exclui todos os arquivos `.env*`, e o Dockerfile não declara `ARG` para segredos. Configure as variáveis apenas no ambiente do serviço em execução. Não use `DATABASE_URL` ou chaves de API como build arguments; valores podem aparecer em logs e metadados do build.

Para hospedar a Evolution API em outro serviço, use [`.env.evolution.easypanel.example`](.env.evolution.easypanel.example) como modelo do ambiente **da Evolution**, de acordo com a versão da imagem escolhida. Ela deve ter um banco PostgreSQL separado do Ofertou. Use a mesma chave em `AUTHENTICATION_API_KEY` (Evolution) e `EVOLUTION_API_KEY` (Ofertou); copie a URL interna do Redis nos dois serviços. Não coloque as senhas reais nos arquivos do repositório. Se a senha da URL contiver caracteres especiais, codifique-os para URL ou copie a URL pronta fornecida pelo EasyPanel.

Neste estágio, apenas `DATABASE_URL` é lida pelo comando de migrations e pelo seed manual. `REDIS_URL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `OPENAI_API_KEY` ficam preparados para a implementação posterior de fila, envio e IA; colá-las no EasyPanel **não ativa** essas funções nem o login. Para publicar só a demonstração, `NODE_ENV` e `PORT` são suficientes. As variáveis `SEED_OWNER_*` de [`.env.example`](.env.example) devem ser usadas somente no processo manual do seed, nunca como senha permanente do app.

### Webhook da Evolution API

O Ofertou recebe `POST https://SEU_DOMINIO_OFERTOU/api/webhooks/evolution`. No ambiente **do app Ofertou**, configure `EVOLUTION_INSTANCE_NAME` com o nome exato da instância e `EVOLUTION_WEBHOOK_SECRET` com um segredo aleatório de pelo menos 32 caracteres, diferente da chave da API. Configure o webhook **por instância** na Evolution com essa URL, `webhookByEvents=false`, `base64=false` e um cabeçalho personalizado `x-ofertou-webhook-secret` com o mesmo segredo. Escolha os eventos necessários, como `CONNECTION_UPDATE` e `QRCODE_UPDATED`. A disponibilidade de cabeçalhos personalizados depende da versão instalada da Evolution; confirme que ela encaminha o cabeçalho antes de ativar os eventos. O webhook global por variáveis de ambiente não permite esse cabeçalho na configuração documentada.

A rota rejeita chamadas sem segredo, instâncias diferentes, JSON inválido e corpos acima de 256 KiB. Uma resposta `202` com `processed:false` confirma apenas o recebimento. Ainda não há persistência de eventos, associação ao workspace, atualização de status, fila ou envio de mensagens. Não publique esse endereço como integração operacional até essas etapas serem implementadas. Nunca registre payloads ou segredos nos logs.

## Seed manual de acesso local

Defina `POSTGRES_PASSWORD` e `DATABASE_URL` no ambiente, inicie PostgreSQL 16 e execute `pnpm db:migrate`. Depois defina `SEED_OWNER_EMAIL`, `SEED_OWNER_NAME`, `SEED_WORKSPACE_NAME` e `SEED_OWNER_PASSWORD` no ambiente do processo. A senha deve ter pelo menos 15 caracteres. Execute `pnpm seed:access`. Não coloque a senha no comando, em arquivos versionados ou em exemplos de documentação.

O seed cria o primeiro usuário, seu hash Argon2id, workspace e papel `owner`. Opcionalmente, `SEED_ACCESS_USERS` aceita um array JSON de até três objetos com `email`, `name`, `password` e `role` (`admin`, `operador` ou `visualizador`). Cada senha deve ter pelo menos 15 caracteres. O primeiro dono só pode ser criado em um banco sem contas; ao repetir o seed, senhas e papéis existentes não são alterados. O seed não habilita login na interface. Consulte [regras-negocio.md](docs/regras-negocio.md) para os controles ainda pendentes.

## Identidade visual

Paleta fornecida: `#FF5E2B`, `#FF8C42`, `#FFDAA5`, `#1A1A1A`, `#F2F2F2`. Tipografia: Manrope nos títulos e DM Sans na interface, com fallback de sistema.

## Próximos módulos de produção

Autenticação, PostgreSQL/Drizzle, RLS, adapters oficiais, Redis/BullMQ, worker, auditoria e testes de integração. Veja [architecture.md](docs/architecture.md) e [regras-negocio.md](docs/regras-negocio.md).
