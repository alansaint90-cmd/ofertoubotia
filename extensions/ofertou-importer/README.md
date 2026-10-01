# Importador Ofertou (Chrome, versão inicial)

## Instalação
1. Extraia `ofertou-importer.zip` numa pasta permanente.
2. Abra `chrome://extensions`, ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
4. Fixe a extensão Ofertou na barra do Chrome.

## Primeiro produto
1. Implante a versão atual do Ofertou no EasyPanel. A migração 0005 deve já estar aplicada; esta mudança não cria novas tabelas.
2. Abra a extensão e confira o domínio HTTPS do seu Ofertou.
3. Cole seu link original `https://meli.la/23PhNuW` e clique **Abrir link de afiliado**.
4. Na nova aba, aguarde o produto aparecer, abra a extensão e clique **Capturar produto desta aba**.
5. Confira foto, título, preço e condições. Clique **Revisar no Ofertou**.
6. Em Integrações, libere o acesso à coleção com a chave de produtos existente. A prévia aparecerá na coleção.
7. Confirme a revisão e clique **Confirmar e importar**. Um cadastro com o mesmo link será atualizado (inclusive se estava pendente); um produto pausado permanece pausado.

## Limites e privacidade
- Não instalada nem publicada na Chrome Web Store automaticamente. Instalação local feita pelo usuário.
- Permissões: activeTab, scripting e storage. Captura somente após clique. Sem cookies, senhas, histórico ou tokens de API.
- A captura lê título, foto, preço atual e condições da página visível. Falha se não reconhecer os campos; não escolhe recomendados.
- Transporte por fragmento da URL para a prévia, sem credenciais. O fragmento não vai no pedido HTTP e é removido quando a coleção lê a captura. Não compartilhe essa URL se não quiser compartilhar o link de afiliado.
- Salvar requer sessão de produtos válida, origem do próprio Ofertou, permissão e workspace; há validação Zod e auditoria. Não usa a sessão de configuração Evolution.
- Capturas expiram para importação após 24 horas. Preços não se atualizam automaticamente. Condições como Pix, cupom e vendedor podem mudar.
- IDs de catálogo `/p/MLB…` são salvos em details.catalogId; apenas IDs de anúncio identificados entram em item_id. A captura não depende da API.
- A revisão não publica nem agenda mensagens. Importação em lote e atualização periódica ficam fora desta primeira versão.
- Layouts suportados: destaque social `.poly-card` e página de produto `.ui-pdp-container`. Mudanças do Mercado Livre podem exigir atualização.

Referências: https://developer.chrome.com/docs/extensions/reference/api/scripting e https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
