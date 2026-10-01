import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureProduct } from '../extensions/ofertou-importer/capture.js';

test('captura somente destaque, preço atual e condições de pagamento', () => {
  const nodes = {
    '.andes-money-amount__fraction': { textContent: '1.234' },
    '.andes-money-amount__cents': { textContent: '90' },
    '.andes-money-amount__currency-symbol': { textContent: 'R$' },
  };
  const card = { querySelector: selector => ({
    'a.poly-component__title': { textContent: 'Travesseiro', href: 'https://www.mercadolivre.com.br/p/MLB19689111' },
    'img.poly-component__picture': { currentSrc: 'https://http2.mlstatic.com/photo.webp' },
    '.poly-price__current .andes-money-amount': { querySelector: key => nodes[key] },
    '.poly-component__price': { textContent: 'R$ 1.234,90 no Pix' },
  })[selector] };
  const button = { textContent: 'Ir para produto', getClientRects: () => [1], closest: () => card };
  globalThis.location = { href: 'https://www.mercadolivre.com.br/social/teste' };
  globalThis.document = { querySelectorAll: () => [button] };
  try {
    const result = captureProduct();
    assert.equal(result.price, 1234.90);
    assert.equal(result.description, 'R$ 1.234,90 no Pix');
    assert.equal(result.title, 'Travesseiro');
    nodes['.andes-money-amount__currency-symbol'].textContent = 'US$';
    assert.throws(captureProduct, /capturar/);
    globalThis.document.querySelectorAll = () => [button, button];
    assert.throws(captureProduct, /único/);
    globalThis.location.href = 'https://example.com/';
    assert.throws(captureProduct, /Mercado Livre/);
  } finally { delete globalThis.location; delete globalThis.document; }
});
