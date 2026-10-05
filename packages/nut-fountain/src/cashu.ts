import { getDecodedTokenBinary, getEncodedTokenBinary, type Token } from '@cashu/cashu-ts';
import { decodeBase64Url, encodeBase64Url, decodeCbor } from './encoding';

export type { Token } from '@cashu/cashu-ts';

const binaryPrefix = new TextEncoder().encode('crawB');

/** Convert Cashu V4 text or a cashu-ts Token into crawB binary. Text CBOR is preserved. */
export function tokenToBytes(token: string | Token): Uint8Array {
  if (typeof token !== 'string') {
    const bytes = getEncodedTokenBinary(token);
    bytesToToken(bytes);
    return bytes;
  }
  if (!token.startsWith('cashuB')) throw new Error('Only Cashu V4 (cashuB) tokens are supported');
  const cbor = decodeBase64Url(token.slice(6));
  const bytes = new Uint8Array(binaryPrefix.length + cbor.length);
  bytes.set(binaryPrefix);
  bytes.set(cbor, binaryPrefix.length);
  bytesToToken(bytes);
  return bytes;
}

function normalizeTokenBytes(bytes: Uint8Array): Uint8Array {
  if (new TextDecoder().decode(bytes.subarray(0, 6)) === 'cashuB') {
    return tokenToBytes(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  return bytes;
}

/**
 * Decode crawB binary or recovered UTF-8 cashuB bytes into a cashu-ts Token.
 * Keyset IDs retain the encoded length; no mint lookup expands short IDs.
 * cashu-ts normalizes Amount values, defaults missing unit to sat, and returns
 * witness metadata as its serialized JSON string.
 */
export function bytesToToken(bytes: Uint8Array): Token {
  bytes = normalizeTokenBytes(bytes);
  const token = getDecodedTokenBinary(bytes);
  decodeCbor(bytes.subarray(binaryPrefix.length));
  if (typeof token.mint !== 'string' || token.mint.length === 0 ||
      typeof token.unit !== 'string' || token.unit.length === 0 ||
      token.proofs.length === 0 ||
      (token.memo !== undefined && typeof token.memo !== 'string') ||
      token.proofs.some(proof => typeof proof.secret !== 'string')) {
    throw new Error('Invalid Cashu V4 token contents');
  }
  return token;
}

/** Convert crawB or UTF-8 cashuB bytes to unpadded cashuB text without reserializing CBOR. */
export function bytesToTokenString(bytes: Uint8Array): string {
  bytes = normalizeTokenBytes(bytes);
  bytesToToken(bytes);
  return 'cashuB' + encodeBase64Url(bytes.subarray(5));
}
