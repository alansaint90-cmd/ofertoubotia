import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchMediaPayload } from '../src/lib/evolution/dispatch-media.ts';
test('coleção envia foto com legenda e rejeita endereço não permitido', () => {
  assert.deepEqual(dispatchMediaPayload('123@g.us', 'Título\nR$ 87,05\nlink', { source: 'collection', imageUrl: 'https://http2.mlstatic.com/photo.webp' }), { number: '123@g.us', mediatype: 'image', media: 'https://http2.mlstatic.com/photo.webp', caption: 'Título\nR$ 87,05\nlink' });
  assert.throws(() => dispatchMediaPayload('123@g.us', 'texto', { source: 'collection', imageUrl: 'http://127.0.0.1/' }));
});
