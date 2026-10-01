import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/browser-import.ts') && specifier.startsWith('./')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { browserImportSchema, productIdentity } = await import('../src/lib/integrations/browser-import.ts');
hook.deregister();
test('catálogo não vira anúncio; wid explícito é separado', () => {
  assert.deepEqual(productIdentity('https://www.mercadolivre.com.br/p/MLB19689111'), { catalogId: 'MLB19689111', itemId: null });
  assert.deepEqual(productIdentity('https://www.mercadolivre.com.br/p/MLB19689111?wid=MLB5174392077'), { catalogId: 'MLB19689111', itemId: 'MLB5174392077' });
});
test('importação valida origem dos dados, validade e campos completos', () => {
  const valid = { version: 1, affiliateUrl: 'https://meli.la/23PhNuW', productUrl: 'https://www.mercadolivre.com.br/p/MLB19689111', title: 'Produto', price: 18.9, imageUrl: 'https://http2.mlstatic.com/photo.webp', description: 'No Pix', capturedAt: new Date().toISOString() };
  assert.equal(browserImportSchema.safeParse(valid).success, true);
  for (const patch of [{ price: 0 }, { title: '' }, { productUrl: 'https://evil.example/p/MLB19689111' }, { affiliateUrl: 'javascript:alert(1)' }, { imageUrl: 'https://127.0.0.1/photo' }, { capturedAt: '2020-01-01T00:00:00.000Z' }, { capturedAt: new Date(Date.now()+3600000).toISOString() }]) assert.equal(browserImportSchema.safeParse({ ...valid, ...patch }).success, false);
});
