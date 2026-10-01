import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOfferCopy } from '../src/lib/integrations/offer-copy.ts';
test('copy preserva condições e não envia chave ao conteúdo', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  try {
    const input = { field: 'description', title: 'Kit', price: 87.05, description: 'R$ 87,05 no Pix' };
    const result = await generateOfferCopy(input, async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.input.includes('test-only'), false);
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Confira este kit!' }] }] });
    });
    assert.equal(result, 'Confira este kit!\n\nR$ 87,05 no Pix');
    await assert.rejects(() => generateOfferCopy(input, async () => Response.json({ status: 'incomplete', output: [] })), /concluiu/);
    await assert.rejects(() => generateOfferCopy(input, async () => new Response('', { status: 429 })), /Limite/);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
