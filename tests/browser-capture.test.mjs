import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureProduct } from '../extensions/ofertou-importer/capture.js';

test('preserva título, selo, desconto exibido e parcelas sem inventar juros', () => {
  const amount = (fraction, cents = '00') => ({ querySelector: selector => ({ textContent: ({
    '.andes-money-amount__fraction': fraction,
    '.andes-money-amount__cents': cents,
    '.andes-money-amount__currency-symbol': 'R$',
  })[selector] ?? '' }) });
  const fields = {
    'h1.ui-pdp-title': { textContent: 'Lavadora de Alta Pressão Compacta WAP WL 1800 1400W 1500PSI 360L/h 220V' },
    'img.ui-pdp-image': { src: 'https://http2.mlstatic.com/photo.webp' },
    '.ui-pdp-price__second-line .andes-money-amount': amount('299'),
    '.ui-pdp-price__original-value': amount('575'),
    '.ui-pdp-price__second-line .andes-money-amount__discount': { textContent: '48% OFF' },
    '.ui-pdp-price__subtitles': { textContent: '12x R$ 29,25' },
    '.ui-pdp-promotions-pill-label': { textContent: 'MAIS VENDIDO' },
    '.ui-pdp-review__rating': { textContent: '4.8' },
    '.ui-pdp-subtitle': { textContent: 'Novo | +10mil vendidos' },
  };
  globalThis.location = { href: 'https://produto.mercadolivre.com.br/MLB-123456789-lavadora' };
  globalThis.document = { querySelector: () => ({ querySelector: selector => fields[selector] }) };
  try {
    const result = captureProduct();
    assert.equal(result.title, fields['h1.ui-pdp-title'].textContent);
    assert.match(result.description.replace(/\u00a0/g, ' '), /De R\$ 575,00 por R\$ 299,00/);
    assert.match(result.description, /48% OFF\n12x R\$ 29,25/);
    assert.match(result.description, /Mais vendido/);
    assert.match(result.description, /4.8.*10mil vendidos/);
    assert.doesNotMatch(result.description, /sem juros/);
    delete fields['.ui-pdp-promotions-pill-label'];
    delete fields['.ui-pdp-price__original-value'];
    delete fields['.ui-pdp-price__subtitles'];
    const minimal = captureProduct();
    assert.doesNotMatch(minimal.description, /Mais vendido|OFF|12x|De R/);
  } finally { delete globalThis.location; delete globalThis.document; }
});

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
