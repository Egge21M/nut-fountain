import { expect, test } from 'bun:test';
import { FountainEncoder as CompatibleEncoder } from 'nut-fountain/encoder';
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';
import { createFrameQr, readQrPixels } from '../src/qr';
import QRCode from 'qrcode';
import { AutoDecoder } from 'nut-fountain/auto';
import { bytesToToken, bytesToTokenString, tokenToBytes } from 'nut-fountain/cashu';
import { makeDemoToken } from '../src/demo';
import { urParts } from './ur-fixtures';

function scan(qr: ReturnType<typeof createFrameQr>) {
  const scale = 4, side = (qr.modules.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const at = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
    }
  }
  return readQrPixels(pixels, side, side)!;
}


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

const sample = bytesToToken(tokenToBytes(makeDemoToken()));
sample.proofs = sample.proofs.slice(0, 1);
const token = bytesToTokenString(tokenToBytes(sample));
for (const binary of [false, true]) for (const mode of ['single', 'multipart', 'repairs'] as const) {
  test(`scanner auto-detects ${mode} UR carrying ${binary ? 'crawB' : 'cashuB text'}`, () => {
    const payload = binary ? tokenToBytes(token) : new TextEncoder().encode(token);
    const parts = urParts(payload, mode === 'single' ? 4096 : 40, mode === 'repairs');
    const reader = new AutoDecoder();
    // Invalid UR cannot lock the format or poison the transfer.
    expect(reader.receive(new TextEncoder().encode('ur:bytes/zz'))).toBe(false);
    expect(reader.format).toBeUndefined();
    for (let i = 0; i < parts.length && !reader.isComplete; i++) {
      const part = i % 2 ? parts[i]! : parts[i]!.toUpperCase();
      const qr = QRCode.create(part, { errorCorrectionLevel: 'M' });
      if (i % 2 === 0) expect(qr.segments.every(segment => segment.mode.id === 'Alphanumeric')).toBe(true);
      const bytes = scan(qr);
      expect(new TextDecoder().decode(bytes)).toBe(part);
      reader.receive(bytes);
      const before = reader.progress;
      reader.receive(bytes);
      expect(reader.progress).toBe(before);
      expect(reader.progress === 1).toBe(reader.isComplete);
    }
    expect(reader.format).toBe('ur');
    expect(reader.isComplete).toBe(true);
    expect(bytesToTokenString(reader.result!)).toBe(token);
  });
}

test('scanner preserves binary bytes and keeps active formats separate until reset', () => {
  const sender = new FountainEncoder(tokenToBytes(token), { fragmentSize: 40 });
  let reader = new AutoDecoder();
  reader.receive(scan(createFrameQr(sender.nextFrame())));
  const before = reader.progress;
  const ur = scan(QRCode.create(urParts(new TextEncoder().encode(token), 4096)[0]!));
  expect(() => reader.receive(ur)).toThrow(/another message/);
  expect(reader.progress).toBe(before);
  while (!reader.isComplete) reader.receive(scan(createFrameQr(sender.nextFrame())));
  expect(bytesToTokenString(reader.result!)).toBe(token);
  reader = new AutoDecoder();
  reader.receive(ur);
  expect(reader.format).toBe('ur');
  expect(bytesToTokenString(reader.result!)).toBe(token);
});

for (const winner of ['binary', 'ur'] as const) {
  test(`compatibility QR pixels support ${winner}-only receivers`, () => {
    const sender = new CompatibleEncoder(tokenToBytes(token), {
      mode: 'compatibility', fragmentSize: 80, urPayload: new TextEncoder().encode(token),
    });
    const reader = new AutoDecoder();
    for (let i = 0; i < 200 && !reader.isComplete; i++) {
      const frame = sender.nextFrame();
      if ((i % 2 === 0) !== (winner === 'binary')) continue;
      const qr = createFrameQr(frame);
      expect(qr.segments[0]!.mode.id).toBe(winner === 'binary' ? 'Byte' : 'Alphanumeric');
      reader.receive(scan(qr));
    }
    expect(bytesToTokenString(reader.result!)).toBe(token);
  });
}

test('maximum playground compatibility fragments fit both QR formats', () => {
  const sender = new CompatibleEncoder(new Uint8Array(10000), {
    mode: 'compatibility', fragmentSize: 2307, urFragmentSize: 1536,
  });
  for (let i = 0; i < 40; i++) {
    const frame = sender.nextFrame();
    const qr = createFrameQr(frame);
    expect(qr.version).toBeLessThanOrEqual(40);
    if (i < 2) expect(scan(qr)).toEqual(frame);
  }
});
