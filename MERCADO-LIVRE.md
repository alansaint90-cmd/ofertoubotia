# Consulta de produtos Mercado Livre

## Coleção persistente

Após atualizar, execute `pnpm db:migrate` no serviço para criar `product_collection`. Libere novamente a chave de produtos em Integrações: a nova sessão permite gerenciar a coleção e exige `offers:write` do dono ativo. Sessões antigas apenas de leitura não permitem gravar. A chave de configuração Evolution não dá acesso a este cadastro.

Em Minha coleção de produtos, cadastre um link HTTPS Mercado Livre/meli.la. O ID MLB é extraído do caminho de links completos quando possível; links curtos exigem ID informado pelo operador. Nenhum redirecionamento de link é buscado pelo servidor. A associação não certifica comissão nem que o destino de um link curto corresponde ao ID fornecido; revise antes do uso.

Lotes aceitam até 200 linhas no formato `link;MLB1234567890;nome opcional`. Linhas inválidas impedem a gravação do lote inteiro e retornam números de linha. Duplicatas por workspace/ID são ignoradas. Edição, pausa/retomada e remoção lógica são auditadas. Remoção preserva histórico; o anúncio pode ser cadastrado novamente. Esta etapa não ativa agendamento ou envio.

Configure `MERCADO_LIVRE_PRODUCTS_TOKEN` no serviço principal com uma chave aleatória de pelo menos 32 caracteres, diferente da chave Evolution. Gere localmente com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não versione o valor.

Após implantar, abra Integrações > Produtos reais · Mercado Livre e libere a consulta com essa chave. A sessão HttpOnly dura 15 minutos e está limitada à leitura de produtos do workspace configurado em EVOLUTION_WORKSPACE_ID. Não é um login geral. A permissão do proprietário ativo é conferida no banco.

Consulte um ID de anúncio MLB ou liste os anúncios ativos da conta vendedora conectada, em páginas de dez itens (até mil). Uma conta apenas de afiliado pode não ter anúncios próprios. O endpoint não fornece uma busca geral de oportunidades de afiliados nem gera links com comissão. Os resultados reais permanecem separados do catálogo demo e não são publicados automaticamente.

Os tokens são renovados sob demanda, antes de consultar, quando faltarem até 60 segundos para expirar. Um 401 provoca no máximo uma renovação e uma repetição da consulta. Não é necessário criar outro worker. Sem consultas, nenhum processo periódico fica renovando tokens.

Uma reserva persistida no PostgreSQL impede consumo concorrente do refresh token de uso único. A gravação dos tokens novos usa comparação do registro reservado para não sobrescrever uma reconexão. Falhas ou interrupções na renovação podem exigir reconectar a conta. Tokens antigos não são reutilizados após resultado incerto. Sucessos e falhas são auditados; segredos nunca são retornados ao cliente.

A coleção exige a migração de product_collection. TypeScript, lint e testes com respostas simuladas validam o contrato; a confirmação ponta a ponta depende da implantação com banco e credenciais reais.

Fontes oficiais:
- https://developers.mercadolivre.com.br/itens-e-buscas
- https://developers.mercadolivre.com.br/pt_br/gerenciamento-perguntas-respostas/autenticacao-e-autorizacao
