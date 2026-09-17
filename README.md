# Ofertou

Interface de demonstração do Ofertou, um SaaS para organizar ofertas de afiliados.

## Executar

Requer Node.js 24 e pnpm. Execute `pnpm install` e `pnpm dev`, então abra `http://localhost:3000`. Para verificar: `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`.

O modo demo apresenta produtos, grupos, editor de oferta, agendamento local, histórico visual, perfil, central de ajuda e relatórios básicos. Não envia mensagens e não gera links afiliados reais. Ofertas, agendamentos e dados do perfil ficam neste navegador. Os relatórios usam apenas esses registros locais; cliques, vendas e comissões não estão disponíveis. O esquema PostgreSQL e as migrations já estão em `src/lib/db`, mas a interface demo ainda não utiliza o banco.

## EasyPanel

Copie o conteúdo de [`.env.easypanel.example`](.env.easypanel.example) para **App → Environment**, substituindo todos os marcadores. Crie serviços PostgreSQL 16 e Redis no mesmo projeto e copie as URLs internas de **Credentials**. Configure o domínio do app para a porta interna `3000`. Use Node.js 24, instale as dependências com `pnpm install --frozen-lockfile`, compile com `pnpm build` e inicie com `pnpm start`. O EasyPanel aceita linhas `CHAVE=valor` e fornece essas variáveis ao build e ao contêiner.

Se o serviço EasyPanel estiver configurado para construir com Dockerfile, use `Dockerfile` na raiz do repositório. Ele instala as dependências, compila o Next.js e inicia na porta `3000`. O build não precisa de credenciais: a `.dockerignore` exclui todos os arquivos `.env*`, e o Dockerfile não declara `ARG` para segredos. Configure as variáveis apenas no ambiente do serviço em execução. Não use `DATABASE_URL` ou chaves de API como build arguments; valores podem aparecer em logs e metadados do build.

Para hospedar a Evolution API em outro serviço, use [`.env.evolution.easypanel.example`](.env.evolution.easypanel.example) como modelo do ambiente **da Evolution**, de acordo com a versão da imagem escolhida. Ela deve ter um banco PostgreSQL separado do Ofertou. Use a mesma chave em `AUTHENTICATION_API_KEY` (Evolution) e `EVOLUTION_API_KEY` (Ofertou); copie a URL interna do Redis nos dois serviços. Não coloque as senhas reais nos arquivos do repositório. Se a senha da URL contiver caracteres especiais, codifique-os para URL ou copie a URL pronta fornecida pelo EasyPanel.

Neste estágio, `DATABASE_URL` é lida pelo comando de migrations e pelo seed manual. `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME` são usadas pela tela protegida de conexão do WhatsApp. `REDIS_URL` e `OPENAI_API_KEY` ficam preparados para fila e IA; colá-las no EasyPanel **não ativa** envio de mensagens nem login geral do app. Para publicar só a demonstração, `NODE_ENV` e `PORT` são suficientes. As variáveis `SEED_OWNER_*` de [`.env.example`](.env.example) devem ser usadas somente no processo manual do seed, nunca como senha permanente do app.

### Conectar WhatsApp pelo Ofertou

No ambiente **do app Ofertou**, configure `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` e `EVOLUTION_SETUP_TOKEN`. Gere o último com 32 bytes aleatórios, por exemplo `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, e guarde-o fora do repositório. A chave de configuração é diferente da chave da API e do segredo do webhook. Em `/integrations`, informe essa chave uma vez; o servidor cria uma sessão protegida de 30 minutos em cookie HttpOnly. Use **Conectar** para obter o QR Code e escaneie-o no WhatsApp em **Aparelhos conectados**. **Atualizar** consulta o estado da instância; a tela também consulta a cada 10 segundos enquanto estiver desconectada.

As chamadas para `instance/connectionState` e `instance/connect` são feitas apenas no servidor. A chave da Evolution não é enviada ao navegador. Use a chave de configuração apenas com administradores e troque-a se for divulgada.

### Publicar ofertas no único grupo autorizado

O envio real exige PostgreSQL migrado, o seed de acesso e um worker separado. Execute `pnpm db:migrate` e `pnpm seed:access` no ambiente do banco do Ofertou. O seed mostra o `Workspace ID`; configure esse UUID como `EVOLUTION_WORKSPACE_ID` no app **e** no worker. Também configure `DATABASE_URL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME` nos dois serviços. O app ainda precisa de `EVOLUTION_SETUP_TOKEN` para liberar a operação protegida. Crie um segundo serviço no EasyPanel com o mesmo código/imagem, sem domínio público, e comando `pnpm worker:evolution`; não execute dois workers para a mesma operação sem planejar a capacidade.

Em **Integrações**, acesse com a chave de configuração e cole o convite do grupo indicado para esta operação. O Ofertou consulta a Evolution, confere que o número conectado participa do grupo e grava seu ID como único destino ativo. O código do convite é comparado no servidor com um hash do grupo autorizado; outro convite é recusado. O convite não é publicado no repositório.

No editor, revise a mensagem, substitua os dados demonstrativos por dados reais, informe um link de afiliado HTTPS válido, marque a confirmação e clique em **Publicar no grupo autorizado**. O servidor grava a oferta e o envio na fila do PostgreSQL; o worker consulta a conexão e envia somente ao ID do grupo vinculado. O botão não chama a Evolution diretamente. O mesmo produto fica bloqueado nesse grupo por 24 horas. Falhas antes da chamada de envio podem ser tentadas até três vezes; quando o resultado do envio é incerto, o worker não repete automaticamente para evitar duplicidade. `accepted` significa aceito pela Evolution, não entregue aos participantes.

Esta operação usa uma chave de configuração de alta entropia e o workspace do dono sem habilitar login geral do SaaS. As ações de vinculação e envio são registradas em `audit_logs` com a origem da sessão de configuração. O catálogo e os agendamentos da interface continuam demonstrativos. O envio só ocorre após clique explícito e revisão; não há descoberta automática de ofertas nem envio agendado.

### Webhook da Evolution API

O Ofertou recebe `POST https://SEU_DOMINIO_OFERTOU/api/webhooks/evolution`. No ambiente **do app Ofertou**, configure `EVOLUTION_INSTANCE_NAME` com o nome exato da instância e `EVOLUTION_WEBHOOK_SECRET` com um segredo aleatório de pelo menos 32 caracteres, diferente da chave da API. Configure o webhook **por instância** na Evolution com essa URL, `webhookByEvents=false`, `base64=false` e um cabeçalho personalizado `x-ofertou-webhook-secret` com o mesmo segredo. Escolha os eventos necessários, como `CONNECTION_UPDATE` e `QRCODE_UPDATED`. A disponibilidade de cabeçalhos personalizados depende da versão instalada da Evolution; confirme que ela encaminha o cabeçalho antes de ativar os eventos. O webhook global por variáveis de ambiente não permite esse cabeçalho na configuração documentada.

A rota rejeita chamadas sem segredo, instâncias diferentes, JSON inválido e corpos acima de 256 KiB. Uma resposta `202` com `processed:false` confirma apenas o recebimento. Ainda não há persistência de eventos, associação ao workspace, atualização de status, fila ou envio de mensagens. Não publique esse endereço como integração operacional até essas etapas serem implementadas. Nunca registre payloads ou segredos nos logs.

## Seed manual de acesso local

Defina `DATABASE_URL` no **ambiente de execução do serviço Ofertou** (não apenas nos argumentos de build ou no serviço PostgreSQL), inicie PostgreSQL 16 e execute `pnpm db:check` no terminal do app. Esse comando verifica URL, conexão e presença das tabelas sem imprimir endereço ou senha. Se a conexão estiver disponível mas as tabelas estiverem incompletas, execute `pnpm db:migrate` e repita `pnpm db:check`. Aguarde o término da migration e seu código de saída; a animação `applying migrations...` sozinha não indica sucesso nem informa a causa de uma falha. Se falhar, guarde o erro completo após essa linha, removendo URLs e segredos antes de compartilhar.

Depois defina `SEED_OWNER_EMAIL` (e-mail válido), `SEED_OWNER_NAME` e `SEED_WORKSPACE_NAME` (2 a 100 caracteres cada) e `SEED_OWNER_PASSWORD` (pelo menos 15 caracteres, no máximo 1024 bytes) no ambiente **do processo que executa o seed**, e execute `pnpm seed:access`. `POSTGRES_PASSWORD` isolada não substitui `DATABASE_URL` no app. As variáveis `SEED_OWNER_*` não fazem parte do template permanente do EasyPanel; remova-as do ambiente do app após o seed. Reinicie o serviço ou abra um novo terminal se as variáveis foram alteradas no painel. Não coloque a senha no comando, em arquivos versionados ou em exemplos de documentação. O seed informa os nomes dos campos inválidos sem imprimir seus valores.

O seed cria o primeiro usuário, seu hash Argon2id, workspace e papel `owner`. Opcionalmente, `SEED_ACCESS_USERS` aceita um array JSON de até três objetos com `email`, `name`, `password` e `role` (`admin`, `operador` ou `visualizador`). Cada senha deve ter pelo menos 15 caracteres. O primeiro dono só pode ser criado em um banco sem contas; ao repetir o seed, senhas e papéis existentes não são alterados. O seed não habilita login na interface. Consulte [regras-negocio.md](docs/regras-negocio.md) para os controles ainda pendentes.

## Identidade visual

Paleta fornecida: `#FF5E2B`, `#FF8C42`, `#FFDAA5`, `#1A1A1A`, `#F2F2F2`. Tipografia: Manrope nos títulos e DM Sans na interface, com fallback de sistema.

## Próximos módulos de produção

Autenticação, PostgreSQL/Drizzle, RLS, adapters oficiais, Redis/BullMQ, worker, auditoria e testes de integração. Veja [architecture.md](docs/architecture.md) e [regras-negocio.md](docs/regras-negocio.md).
