import { expect, test } from 'bun:test';
import { Amount, getEncodedToken, type Token } from '@cashu/cashu-ts';
import { tokenToBytes, bytesToToken, bytesToTokenString } from '../src/cashu';

const token: Token = {
  mint: 'https://mint.example',
  unit: 'sat',
  memo: 'Fountain experiment',
  proofs: [{
    id: '009a1f293253e41e',
    amount: Amount.from(1),
    secret: 'test-secret',
    C: '02' + '11'.repeat(32),
  }],
};

test('cashuB text survives conversion to binary and back with its exact CBOR', () => {
  const text = getEncodedToken(token);
  const bytes = tokenToBytes(text);
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('crawB');
  expect(bytesToTokenString(bytes)).toBe(text);
  expect(bytesToToken(bytes)).toEqual(token);
});

test('Cashu object round trips preserve full keyset IDs, large Amount values and proof metadata', () => {
  const full: Token = {
    ...token,
    proofs: [{
      ...token.proofs[0]!,
      id: '01' + 'ab'.repeat(32),
      amount: Amount.from(9007199254740993n),
      dleq: { e: '11'.repeat(32), s: '22'.repeat(32), r: '33'.repeat(32) },
      p2pk_e: '03' + '44'.repeat(32),
      witness: '{"signatures":["test-signature"]}',
    }],
  };
  const bytes = tokenToBytes(full);
  expect(bytesToToken(bytes)).toEqual(full);
  expect(bytesToToken(tokenToBytes(bytesToTokenString(bytes)))).toEqual(full);
});

test('recovered UTF-8 cashuB payloads from UR can be read using the same helpers', () => {
  const text = getEncodedToken(token);
  const recovered = new TextEncoder().encode(text);
  expect(bytesToToken(recovered)).toEqual(token);
  expect(bytesToTokenString(recovered)).toBe(text);
});

test('invalid token encodings and unsupported versions fail clearly', () => {
  expect(() => tokenToBytes('cashuAeyJ0b2tlbiI6W119')).toThrow(/cashuB/);
  expect(() => tokenToBytes('cashuB!')).toThrow(/base64url/);
  expect(() => tokenToBytes('cashuBoA')).toThrow(); // Empty CBOR map.
  expect(() => bytesToToken(new TextEncoder().encode('crawA'))).toThrow();
  expect(() => bytesToToken(tokenToBytes('cashuBoWF0gA'))).toThrow(); // {t: []}, no mint.
});

test('a binary token cannot hide trailing data after its CBOR payload', () => {
  const valid = tokenToBytes(token);
  const extra = new Uint8Array(valid.length + 1);
  extra.set(valid);
  expect(() => bytesToToken(extra)).toThrow();
});
