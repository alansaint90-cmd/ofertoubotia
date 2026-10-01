# Consulta de produtos Mercado Livre

## Identificação e prévia

Aplique a migração 0005 com `pnpm db:migrate`. Em cada produto salvo, use **Identificar pelo link**. O servidor segue até cinco etapas de redirecionamento HTTPS nos hosts oficiais permitidos, sem cookies nem credenciais OAuth, com conexão fixada ao IPv4 público validado, limite de tamanho e timeout. Identifica anúncios em URLs diretas, parâmetros item_id/wid ou URL canônica. Não escolhe produtos recomendados em vitrines nem confunde identificadores de catálogo com anúncios.

Quando identificado, consulta o anúncio na API com renovação de token, grava título, preço em BRL, foto e estado do anúncio. A prévia exige revisão. Falhas, vitrines, páginas dependentes de JavaScript e bloqueios da plataforma levam ao preenchimento manual, sem contornar os bloqueios.

Use **Preencher e revisar** para título, preço, texto e URL HTTPS da imagem hospedada em mlstatic.com. A prévia mostra foto, legenda e link original de afiliado. Confirme a revisão para persistir. Dados modificados manualmente são marcados como manuais; revisão sem mudanças mantém origem API e data da consulta. Não existe atualização automática de preços manuais. Edição do cadastro básico invalida os detalhes anteriores. A revisão não dispara mensagens nem ativa agendamentos.

Validação local inclui cenários simulados de redirecionamento, rede privada, bloqueio da plataforma e preenchimento manual. A identificação de cada link real depende do destino e do acesso disponível pela API na implantação.

## Coleção persistente

Após atualizar, execute `pnpm db:migrate` no serviço para criar `product_collection`. Libere novamente a chave de produtos em Integrações: a nova sessão permite gerenciar a coleção e exige `offers:write` do dono ativo. Sessões antigas apenas de leitura não permitem gravar. A chave de configuração Evolution não dá acesso a este cadastro.

Em Minha coleção de produtos, cadastre um link HTTPS Mercado Livre/meli.la. O ID MLB é extraído do caminho de links completos quando possível; links curtos podem ser salvos sem ID técnico. Códigos como BU7HG1-L7MB são referências, armazenadas separadamente; o ID técnico fica nulo e a interface exibe identificação pendente. O cadastro inicial não segue redirecionamentos; a consulta é executada ao clicar em Identificar pelo link. A associação não certifica comissão nem que o destino de um link curto corresponde ao ID fornecido; revise antes do uso.

Aplique também a migração 0004 para permitir o ID opcional e criar reference_code. Lotes aceitam códigos de referência ou apenas links, além do formato `link;MLB1234567890;nome opcional`. Linhas inválidas impedem a gravação do lote inteiro e retornam números de linha. Duplicatas por workspace/ID são ignoradas. Edição, pausa/retomada e remoção lógica são auditadas. Remoção preserva histórico; o anúncio pode ser cadastrado novamente. Esta etapa não ativa agendamento ou envio.

Configure `MERCADO_LIVRE_PRODUCTS_TOKEN` no serviço principal com uma chave aleatória de pelo menos 32 caracteres, diferente da chave Evolution. Gere localmente com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não versione o valor.

Após implantar, abra Integrações > Produtos reais · Mercado Livre e libere a consulta com essa chave. A sessão HttpOnly dura 15 minutos e está limitada à leitura de produtos do workspace configurado em EVOLUTION_WORKSPACE_ID. Não é um login geral. A permissão do proprietário ativo é conferida no banco.

Consulte um ID de anúncio MLB ou liste os anúncios ativos da conta vendedora conectada, em páginas de dez itens (até mil). Uma conta apenas de afiliado pode não ter anúncios próprios. O endpoint não fornece uma busca geral de oportunidades de afiliados nem gera links com comissão. Os resultados reais permanecem separados do catálogo demo e não são publicados automaticamente.

Os tokens são renovados sob demanda, antes de consultar, quando faltarem até 60 segundos para expirar. Um 401 provoca no máximo uma renovação e uma repetição da consulta. Não é necessário criar outro worker. Sem consultas, nenhum processo periódico fica renovando tokens.

Uma reserva persistida no PostgreSQL impede consumo concorrente do refresh token de uso único. A gravação dos tokens novos usa comparação do registro reservado para não sobrescrever uma reconexão. Falhas ou interrupções na renovação podem exigir reconectar a conta. Tokens antigos não são reutilizados após resultado incerto. Sucessos e falhas são auditados; segredos nunca são retornados ao cliente.

A coleção exige a migração de product_collection. TypeScript, lint e testes com respostas simuladas validam o contrato; a confirmação ponta a ponta depende da implantação com banco e credenciais reais.

Fontes oficiais:
- https://developers.mercadolivre.com.br/itens-e-buscas
- https://developers.mercadolivre.com.br/pt_br/gerenciamento-perguntas-respostas/autenticacao-e-autorizacao
