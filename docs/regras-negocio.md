# Regras de negócio — Ofertou

## Fluxo central

Produto → link de afiliado → oferta → revisão da copy → grupos → publicação ou agendamento → histórico.

## Modo demonstração

- Produtos e grupos são exemplos fictícios.
- Rascunhos e agendamentos ficam no `localStorage` do navegador.
- Não é gerado link de afiliado real, nem ocorre envio ao WhatsApp.
- O botão de publicação imediata explica a dependência da integração ativa.
- A copy demonstrativa usa apenas preço, desconto, avaliação e volume de vendas presentes no produto selecionado.
- O perfil em Meus Dados fica no navegador e não cria conta, sessão ou permissão. Nome é obrigatório; e-mail e telefone são opcionais e validados.
- Relatórios contam ofertas pela data de criação, com filtros de 7 dias, 30 dias ou todo o período. Uma oferta conta uma vez por grupo selecionado, mesmo se o grupo aparecer repetido. Grupos ativos mostram o estado atual, independentemente do período.
- A central de ajuda explica os limites do modo demonstração; não envia pedidos de suporte.
- O webhook Evolution valida um segredo de cabeçalho e o nome da instância antes de aceitar eventos; seu recebimento não significa que dados foram persistidos ou processados.

## Operação real a implementar

- Cada usuário pertence a um ou mais workspaces. Toda consulta e mutação deve verificar essa associação.
- Apenas o provider oficial gera links afiliados.
- Toda oferta mantém um snapshot do produto no momento da criação.
- Um worker envia uma mensagem por grupo, com intervalo configurável e até três tentativas.
- Bloquear o mesmo produto no mesmo grupo por 24 horas.
- Antes do envio agendado, revisar o preço quando o provider oferecer consulta confiável.
- Segredos de integrações são armazenados somente no servidor, cifrados e nunca incluídos em logs.

## Acesso local de demonstração

- A primeira conta é criada somente por `pnpm seed:access`, de forma manual, em banco vazio.
- O seed exige e-mail, nome, workspace e senha fornecidos na execução. Não existe senha padrão.
- A senha é validada antes do hash e armazenada apenas como Argon2id com salt individual.
- O seed pode incluir até três contas adicionais (`admin`, `operador`, `visualizador`) configuradas no ambiente. E-mails duplicados são recusados.
- Executar o seed novamente não redefine senha nem altera o papel de uma conta existente; conflitos fazem a transação falhar.
- O primeiro membro recebe `owner`; novas associações no banco têm `visualizador` como padrão.
- O seed não ativa uma tela de login. Login, sessão, bloqueio por tentativas, segundo fator e RLS ainda precisam de implementação e teste antes de liberar acesso real.
