import { UR, UREncoder } from '@gandlaf21/bc-ur/dist/lib/es6/index.js';
import { Buffer } from 'buffer';

// Test-only reference implementation; never imported by production app code.
export function urParts(payload: Uint8Array, fragmentSize: number, repairs = false): string[] {
  const encoder = new UREncoder(UR.fromBuffer(Buffer.from(payload)), fragmentSize);
  if (!repairs) return Array.from({ length: encoder.fragmentsLength }, () => encoder.nextPart());
  for (let i = 0; i < encoder.fragmentsLength; i++) encoder.nextPart();
  return Array.from({ length: encoder.fragmentsLength * 8 + 20 }, () => encoder.nextPart())
    .filter((_, i) => i % 3 !== 0).reverse();
}
