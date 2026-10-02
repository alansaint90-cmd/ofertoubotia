import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOfferCopy, cleanOfferTitle } from '../src/lib/integrations/offer-copy.ts';
test('remove chamada anterior antes de gerar outra', () => {
  assert.equal(cleanOfferTitle('✨ Achadinho do dia: Kit de ferramentas'), 'Kit de ferramentas');
  assert.equal(cleanOfferTitle('🔥 Oferta em destaque: ✨ Achadinho do dia: Kit'), 'Kit');
});
test('copy preserva condições e não envia chave ao conteúdo', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  try {
    const input = { field: 'description', title: 'Kit', price: 87.05, description: 'R$ 87,05 no Pix' };
    const result = await generateOfferCopy(input, async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.input.includes('test-only'), false);
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Confira este kit!\nPor R$ 87,05 no Pix' }] }] });
    });
    assert.equal(result, 'Confira este kit!\nPor R$ 87,05 no Pix');
    const title = await generateOfferCopy({ ...input, field: 'title', title: '✨ Achadinho do dia: Kit' }, async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Kit' }] }] }));
    assert.match(title, /: Kit$/);
    assert.equal(title.includes('Cupom'), false);
    assert.equal(title.includes('Achadinho do dia'), false);
    await assert.rejects(() => generateOfferCopy(input, async () => Response.json({ status: 'incomplete', output: [] })), /concluiu/);
    await assert.rejects(() => generateOfferCopy(input, async () => new Response('', { status: 429 })), /Limite/);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
