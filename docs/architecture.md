# Arquitetura

## Base atual

- `src/app`: rotas da interface Next.js.
- `src/components/app.tsx`: navegação e telas do modo demonstração.
- `src/lib/demo.ts`: produtos e grupos de exemplo, formatação e copy determinística.
- `src/lib/demo-profile.ts` e `src/lib/reports.ts`: validação do perfil local e agregação dos relatórios de demonstração.
- `src/components/profile-page.tsx`, `reports-page.tsx` e `help-page.tsx`: telas de perfil, relatórios e FAQ.
- `src/app/api/webhooks/evolution/route.ts`: receptor autenticado e limitado para eventos da Evolution, ainda sem efeitos sobre o banco ou a interface.
- `src/lib/db/schema/index.ts`: 13 tabelas PostgreSQL com auditoria, exclusão lógica e FKs restritivas.
- `src/lib/db/migrations`: migrations do esquema inicial e das credenciais locais.
- `src/lib/auth`: hash Argon2id e matriz de permissões para o acesso local de demonstração.
- `scripts/seed-access.mjs`: provisionamento manual e idempotente do primeiro dono.

O modo demo serve para navegar pelo Golden Path e validar a experiência sem credenciais externas. Seus dados ficam no navegador e não são compartilhados entre dispositivos.

## Serviços previstos para operação real

1. Completar login, sessão, segundo fator e proteção de rotas para as contas locais; integrar Supabase Auth quando o projeto externo existir.
2. Ligar o esquema PostgreSQL 16/Drizzle à sessão, às regras RLS, às ações de servidor e à auditoria.
3. `AffiliateProvider` para pesquisa e geração de links oficiais. O adapter Shopee depende do contrato e das credenciais oficiais.
4. `AIProvider` para geração de copy restrita aos dados do produto. A chave permanece no servidor.
5. `MessagingProvider` para Evolution API, com status, QR e sincronização de grupos.
6. Redis/BullMQ e worker separado para agendamento, envio, retentativas e anti-repetição.

Não habilitar publicações até que autenticação, banco, fila e integrações estejam conectados e testados.
