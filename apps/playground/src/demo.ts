import { Amount } from '@cashu/cashu-ts';
import { bytesToTokenString, tokenToBytes } from 'nut-fountain/cashu';

/** Synthetic proofs for transport testing. These cannot be spent. */
export function makeDemoToken(): string {
  return bytesToTokenString(tokenToBytes({
    mint: 'https://mint.example', unit: 'sat', memo: 'nut-fountain synthetic demo',
    proofs: Array.from({ length: 12 }, (_, i) => ({
      id: '009a1f293253e41e', amount: Amount.from(1),
      secret: `not-spendable-demo-proof-${i.toString().padStart(2, '0')}`,
      C: '02' + '11'.repeat(32),
    })),
  }));
}
