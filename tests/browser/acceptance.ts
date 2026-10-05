import { Amount, type Token } from '@cashu/cashu-ts';
import * as fountain from 'nut-fountain';
import { FountainEncoder, FountainDecoder } from 'nut-fountain/core';
import { tokenToBytes, bytesToToken, bytesToTokenString } from 'nut-fountain/cashu';
import { UrDecoder } from 'nut-fountain/ur';
import { encodeBase64Url, decodeBase64Url, encodeCbor, decodeCbor } from 'nut-fountain/encoding';

export interface Fixtures {
  cashuB: string;
  ur: { label: string; parts: string[] }[];
}

function assert(condition: unknown, description: string): asserts condition {
  if (!condition) throw new Error(description);
}

function noNodeGlobals() {
  assert(!('Buffer' in globalThis), 'Buffer must not be installed globally');
  assert(!('process' in globalThis), 'process must not be installed globally');
}

function roundTrip(message: Uint8Array) {
  const encoder = new FountainEncoder(message, { fragmentSize: 32 });
  const reader = new FountainDecoder();
  for (let i = 0; i < encoder.fragmentCount; i++) reader.receive(encoder.nextFrame());
  assert(reader.isComplete, 'binary fountain transfer must finish');
  return reader.result!;
}

function equivalent(actual: Token, expected: Token) {
  // Amount is a public value object. Check its identity too, to catch a second
  // bundled copy of cashu-ts leaking across the package boundary.
  assert(actual.proofs.every(proof => proof.amount instanceof Amount), 'Amount identity');
  const normalize = (token: Token) => ({
    ...token,
    proofs: token.proofs.map(proof => ({
      id: proof.id, amount: proof.amount.toString(), secret: proof.secret, C: proof.C,
    })),
  });
  const a = normalize(actual), b = normalize(expected);
  assert(a.mint === b.mint && a.unit === b.unit && a.memo === b.memo, 'token metadata must match');
  assert(JSON.stringify(a.proofs) === JSON.stringify(b.proofs), 'token proofs must match');
}

export function runAcceptance(fixtures: Fixtures): string[] {
  noNodeGlobals();
  const passed: string[] = [];
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
  const reconstructed = roundTrip(bytes);
  assert(reconstructed.length === bytes.length && reconstructed.every((value, i) => value === bytes[i]), 'exact byte recovery');
  passed.push('arbitrary bytes -> binary fountain -> exact bytes');

  const expected: Token = {
    mint: 'https://mint.example', unit: 'sat', memo: 'Browser experiment',
    proofs: [{ amount: Amount.from(1), id: '009a1f293253e41e', secret: 'not-spendable', C: '02' + '11'.repeat(32) }],
  };
  const recovered = roundTrip(tokenToBytes(fixtures.cashuB));
  equivalent(bytesToToken(recovered), expected);
  assert(bytesToTokenString(recovered) === fixtures.cashuB, 'text preserves original CBOR');
  passed.push('cashuB -> binary fountain -> token');

  const object: Token = {
    ...expected,
    proofs: [{ ...expected.proofs[0]!, id: '01' + 'ab'.repeat(32), amount: Amount.from(9007199254740993n) }],
  };
  equivalent(fountain.bytesToToken(roundTrip(fountain.tokenToBytes(object))), object);
  passed.push('cashu-ts Token with large Amount and full keyset ID -> binary fountain -> token');

  for (const fixture of fixtures.ur) {
    const reader = new UrDecoder();
    for (const part of fixture.parts) {
      reader.receive(part);
      if (reader.isComplete) break;
    }
    assert(reader.isComplete, `${fixture.label} must finish`);
    equivalent(bytesToToken(reader.result!), expected);
    passed.push(`${fixture.label} -> token`);
  }
  const encoded = encodeCbor('browser');
  assert(decodeCbor(decodeBase64Url(encodeBase64Url(encoded))) === 'browser', 'encoding helper exports');
  passed.push('CBOR and base64url helpers');
  noNodeGlobals();
  return passed;
}
