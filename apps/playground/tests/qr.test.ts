import { expect, test } from 'bun:test';
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';
import { createFrameQr, readQrPixels } from '../src/qr';

test('raw binary fountain frames survive QR pixels without a text encoding', () => {
  const expected = Uint8Array.from({ length: 400 }, (_, i) => i % 256);
  const sender = new FountainEncoder(expected, { fragmentSize: 128 });
  const reader = new FountainDecoder();
  for (let n = 0; n < sender.fragmentCount; n++) {
    const frame = sender.nextFrame();
    const qr = createFrameQr(frame);
    const scale = 6, side = (qr.modules.size + 8) * scale;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const at = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
        pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
      }
    }
    const recovered = readQrPixels(pixels, side, side);
    expect(recovered).toEqual(frame);
    reader.receive(recovered!);
  }
  expect(reader.result).toEqual(expected);
});
