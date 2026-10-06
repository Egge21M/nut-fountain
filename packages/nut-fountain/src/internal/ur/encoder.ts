import { encodeCbor } from '../../encoding.js';
import { crc32 } from '../crc32.js';
import { encodeBytewords } from './bytewords.js';
import { FragmentChooser } from './fragments.js';

/** Complete ur:bytes messages with independent, consecutive sequence numbers. */
export class UrEncoder {
  readonly fragmentCount: number;
  private readonly message: Uint8Array;
  private readonly size: number;
  private readonly checksum: number;
  private readonly chooser: FragmentChooser;
  private sequence = 0;

  constructor(payload: Uint8Array, fragmentSize: number) {
    if (!(payload instanceof Uint8Array)) throw new TypeError('UR payload must be a Uint8Array');
    if (!Number.isInteger(fragmentSize) || fragmentSize < 1 || fragmentSize > 4096) {
      throw new RangeError('urFragmentSize must be an integer from 1 to 4096');
    }
    this.message = encodeCbor(payload);
    if (this.message.length > 1_048_576) throw new RangeError('UR wrapped message exceeds 1048576 bytes');
    this.fragmentCount = Math.ceil(this.message.length / fragmentSize);
    if (this.fragmentCount > 1024) throw new RangeError('UR message requires more than 1024 fragments');
    this.size = Math.ceil(this.message.length / this.fragmentCount);
    this.checksum = crc32(this.message);
    this.chooser = new FragmentChooser(this.fragmentCount);
  }

  nextPart(): string {
    if (this.fragmentCount === 1) return `UR:BYTES/${encodeBytewords(this.message)}`.toUpperCase();
    if (this.sequence === 0xffffffff) throw new RangeError('UR sequence exhausted; create a new encoder');
    const sequence = ++this.sequence;
    const selected = this.chooser.choose(sequence, this.checksum);
    const fragment = new Uint8Array(this.size);
    for (let i = 0; i < selected.length; i++) {
      if (!selected[i]) continue;
      const source = this.message.subarray(i * this.size, (i + 1) * this.size);
      for (let j = 0; j < source.length; j++) fragment[j] = fragment[j]! ^ source[j]!;
    }
    const part = encodeCbor([sequence, this.fragmentCount, this.message.length, this.checksum, fragment]);
    return `UR:BYTES/${sequence}-${this.fragmentCount}/${encodeBytewords(part)}`.toUpperCase();
  }
}
