import { expect, test } from 'bun:test';
import { Buffer } from 'buffer';
import { UR, UREncoder, URDecoder } from '@gandlaf21/bc-ur/dist/lib/es6/index.js';
import { FountainEncoder } from 'nut-fountain/encoder';
import { FountainEncoder as BinaryEncoder, FountainDecoder } from 'nut-fountain/core';
import { AutoDecoder } from 'nut-fountain/auto';
import * as root from 'nut-fountain';

const text = new TextDecoder();
const payload = Uint8Array.from({ length: 257 }, (_, i) => i % 256);

test('default encoder preserves existing binary output and snapshots input', () => {
  expect(root.FountainEncoder).toBe(FountainEncoder);
  const input = payload.slice();
  const encoder = new FountainEncoder(input, { fragmentSize: 40 });
  const binary = new BinaryEncoder(input, { fragmentSize: 40 });
  input.fill(0);
  for (let i = 0; i < 40; i++) expect(encoder.nextFrame()).toEqual(binary.nextFrame());
});

for (const length of [0, 1, 39, 40, 257]) {
  test(`UR output matches reference encoding for ${length} payload bytes`, () => {
    const input = payload.slice(0, length);
    const encoder = new FountainEncoder(input, { mode: 'ur', fragmentSize: 40 });
    const reference = new UREncoder(UR.fromBuffer(Buffer.from(input)), 40);
    expect(encoder.fragmentCount).toBe(reference.fragmentsLength);
    for (let i = 0; i < 100; i++) {
      expect(text.decode(encoder.nextFrame())).toBe(reference.nextPart().toUpperCase());
    }
  });
}

test('alternating streams preserve consecutive sequences and independently recover after loss', () => {
  const encoder = new FountainEncoder(payload, { mode: 'compatibility', fragmentSize: 40 });
  const binary = new BinaryEncoder(payload, { fragmentSize: 40 });
  const reference = new UREncoder(UR.fromBuffer(Buffer.from(payload)), 40);
  const nfReader = new FountainDecoder();
  const legacyReader = new URDecoder();
  const repairs: { nf: Uint8Array; ur: string }[] = [];
  for (let i = 0; i < 100; i++) {
    const nf = encoder.nextFrame(), ur = text.decode(encoder.nextFrame());
    expect(nf).toEqual(binary.nextFrame());
    expect(ur).toBe(reference.nextPart().toUpperCase());
    if (i > Math.max(encoder.fragmentCount, encoder.urFragmentCount!) && i % 3 !== 0) repairs.push({ nf, ur });
  }
  for (const { nf, ur } of repairs.reverse()) {
    if (!nfReader.isComplete) nfReader.receive(nf);
    if (!legacyReader.isComplete()) legacyReader.receivePart(ur);
  }
  expect(nfReader.result).toEqual(payload);
  expect(legacyReader.isSuccess()).toBe(true);
  expect(new Uint8Array(legacyReader.resultUR().decodeCBOR())).toEqual(payload);
});

test('UR alternate payload is copied and does not change the NF payload', () => {
  const alternate = new TextEncoder().encode('cashuBexample');
  const encoder = new FountainEncoder(payload, { mode: 'compatibility', fragmentSize: 4096, urPayload: alternate });
  alternate.fill(0);
  const nf = new FountainDecoder(), ur = new AutoDecoder();
  nf.receive(encoder.nextFrame()); ur.receive(encoder.nextFrame());
  expect(nf.result).toEqual(payload);
  expect(text.decode(ur.result)).toBe('cashuBexample');
});

test('invalid UR settings fail before emitting a partial compatibility transfer', () => {
  for (const urFragmentSize of [0, -1, 1.5, 4097, NaN]) {
    expect(() => new FountainEncoder(payload, { mode: 'compatibility', urFragmentSize })).toThrow();
  }
  expect(() => new FountainEncoder(new Uint8Array(1_048_576), { mode: 'compatibility', fragmentSize: 4096 })).toThrow(/wrapped/);
  expect(() => new FountainEncoder(payload, { mode: 'compatibility', urFragmentSize: 1, urPayload: new Uint8Array(1024) })).toThrow(/1024/);
});

for (const winner of ['binary', 'ur'] as const) {
  test(`mixed receiver allows UR-first input and freezes the ${winner} winner until reset`, () => {
    const encoder = new FountainEncoder(payload, { mode: 'compatibility', fragmentSize: 40 });
    const reader = new AutoDecoder({ allowMixedFormats: true });
    const firstNf = encoder.nextFrame(), firstUr = encoder.nextFrame();
    reader.receive(firstUr); reader.receive(firstNf);
    expect(reader.totalIndependentFrames).toBe(2);
    expect(reader.receive(firstUr)).toBe(false);
    expect(reader.receive('ur:bytes/zz')).toBe(false);
    expect(reader.totalIndependentFrames).toBe(2);
    expect(() => reader.receive(Uint8Array.of(0x4e, 0x46))).toThrow();
    for (let i = 0; i < 100 && !reader.isComplete; i++) {
      const nf = encoder.nextFrame(), ur = encoder.nextFrame();
      reader.receive(winner === 'binary' ? nf : ur);
    }
    expect(reader.format).toBe(winner);
    expect(reader.result).toEqual(payload);
    expect(reader.progress).toBe(1);
    expect(reader.receive(winner === 'binary' ? firstUr : firstNf)).toBe(false);
    expect(reader.format).toBe(winner);
    reader.reset();
    expect(reader.format).toBeUndefined();
    expect(reader.totalIndependentFrames).toBe(0);
    reader.receive(firstNf); reader.receive(firstUr);
    expect(reader.totalIndependentFrames).toBe(2);
  });
}
