# Ofertou — instruções do projeto

O Ofertou organiza a operação de afiliados: descoberta de produtos, criação de ofertas, agendamento e distribuição em grupos WhatsApp.

## Stack e organização

- TypeScript em modo strict, Next.js App Router e React.
- PostgreSQL 16 com Drizzle ORM quando o backend persistente for ativado. Não usar Prisma nem SQLite.
- Interfaces e mensagens em português do Brasil.
- Componentes em `src/components`, regras de negócio em `src/lib`, páginas em `src/app`.
- Nunca colocar credenciais no cliente ou no repositório.

## Dados e segurança

- Toda tabela operacional deve ter `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `is_deleted` e `modified_by`.
- Usar exclusão lógica. Toda leitura deve filtrar registros excluídos.
- Validar entradas no servidor com Zod e conferir sessão, workspace e permissão em cada operação.
- Não usar `CASCADE` em relações de dados críticos. Registrar ações sensíveis em auditoria.
- Envios reais são feitos por worker, com retentativas limitadas, nunca diretamente pelo navegador.
- Não inventar contratos de Shopee, Evolution API ou provedores de IA. Isolar integrações atrás de interfaces e ativá-las somente com documentação e credenciais oficiais.

## Estado atual

A interface contém um modo demonstração local. Produtos, grupos e agendamentos do modo demo são fictícios e não representam envios. Não apresentar esses registros como dados de produção.

O hash Argon2id, a matriz de papéis e o seed manual de contas locais estão preparados no servidor. A interface ainda não autentica usuários: não tratar essas contas como login funcional até existir sessão, segundo fator, bloqueio de tentativas, RLS e auditoria de entrada.

Existe uma sessão de configuração separada, protegida por chave aleatória, para conectar a Evolution e vincular o único grupo autorizado. A publicação real limitada exige workspace do dono no PostgreSQL, revisão manual, link real, clique explícito e worker separado. A sessão de configuração não é login geral do SaaS; não reutilizá-la para operações fora desse fluxo.
