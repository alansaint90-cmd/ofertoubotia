# Campanha automática

1. Configure `CAMPAIGN_ACCESS_TOKEN` no serviço Ofertou com uma chave aleatória de pelo menos 32 caracteres. Gere no console com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não publique a chave no repositório.
2. Implante Ofertou e execute `pnpm db:migrate` (migração 0006).
3. Implante ofertou-worker após a migração. Mantenha `pnpm worker:evolution`, uma réplica e as mesmas variáveis Evolution/workspace/banco. O scheduler roda dentro deste worker, sem cron adicional.
4. Em Agendamentos, abra Campanha automática e libere com a chave própria. A sessão dura uma hora; sua expiração não pausa uma campanha autorizada.
5. Selecione produtos revisados, início/fim no mesmo dia (Brasília), intervalo de 5 ou 10 minutos e validade de revisão entre 1 e 24 horas. Confirme e ative.
6. Confira Histórico (o acesso ao histórico real ainda usa a sessão de publicação/WhatsApp em Integrações). Atualize para consultar fila, aceito, falhou ou incerto.

Uma campanha por workspace, com destino restrito ao grupo já autorizado. Ao esgotar a lista, aguarda o próximo dia. Qualquer tentativa do produto no dia, inclusive manual ou falha, impede nova tentativa automática naquele dia. Produtos pausados/excluídos e revisões vencidas são ignorados. Não há atualização automática de preço. A validade usa a última revisão humana, não garante disponibilidade no fornecedor.

Pausar impede novos enfileiramentos e invalida jobs automáticos ainda não iniciados. Um envio já em processamento pode terminar. Não acumula novos jobs com fila pendente e respeita intervalo após aceitação. Nenhum envio real foi disparado durante desenvolvimento.

Caso o grupo não esteja autorizado ou nenhum produto esteja elegível, a campanha permanece ativa aguardando correção. Verifique estes requisitos antes de ativar. Os agendamentos demo anteriores continuam demonstrativos.
