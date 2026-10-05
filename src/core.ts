import { coefficients, xor, type Equation } from "./internal/core/equations.ts";
import {
  crc32, parseFrame, OVERHEAD, MAX_FRAGMENT_SIZE, MAX_FRAGMENTS, MAX_MESSAGE_LENGTH,
  type Metadata,
} from "./internal/core/wire.ts";

/** Experimental binary fountain transport. See docs/protocol.md for its wire format. */
export class FountainEncoder {
  readonly fragmentCount: number;
  private sequence = 0;
  private readonly message: Uint8Array;
  private readonly fragmentSize: number;
  private readonly checksum: number;

  constructor(message: Uint8Array, options: { fragmentSize?: number } = {}) {
    if (!(message instanceof Uint8Array)) throw new TypeError("Message must be a Uint8Array");
    this.fragmentSize = options.fragmentSize ?? 128;
    if (!Number.isInteger(this.fragmentSize) || this.fragmentSize < 1 || this.fragmentSize > MAX_FRAGMENT_SIZE) {
      throw new RangeError(`fragmentSize must be an integer from 1 to ${MAX_FRAGMENT_SIZE}`);
    }
    this.fragmentCount = Math.max(1, Math.ceil(message.length / this.fragmentSize));
    if (message.length > MAX_MESSAGE_LENGTH || this.fragmentCount > MAX_FRAGMENTS) {
      throw new RangeError(`Message requires more than ${MAX_FRAGMENTS} fragments; use a larger fragmentSize or smaller message`);
    }
    this.message = message.slice();
    this.checksum = crc32(this.message);
  }

  nextFrame(): Uint8Array {
    if (this.sequence === 0xffffffff) throw new RangeError("Fountain sequence exhausted; create a new encoder");
    const sequence = ++this.sequence;
    const frame = new Uint8Array(OVERHEAD + this.fragmentSize);
    frame.set([0x4e, 0x46, 1, 0]);
    const view = new DataView(frame.buffer);
    view.setUint32(4, sequence);
    view.setUint32(8, this.fragmentCount);
    view.setUint32(12, this.message.length);
    view.setUint32(16, this.checksum);
    const selected = coefficients(sequence, this.fragmentCount);
    const data = frame.subarray(20, -4);
    for (let i = 0; i < selected.length; i++) {
      if (!selected[i]) continue;
      const start = i * this.fragmentSize;
      const fragment = this.message.subarray(start, start + this.fragmentSize);
      for (let j = 0; j < fragment.length; j++) data[j] = data[j]! ^ fragment[j]!;
    }
    view.setUint32(frame.length - 4, crc32(frame.subarray(0, -4)));
    return frame;
  }
}

export class FountainDecoder {
  private rows = new Map<number, Equation>();
  private decoded?: Uint8Array;
  private metadata?: Metadata;

  get isComplete(): boolean { return this.decoded !== undefined; }
  get result(): Uint8Array | undefined { return this.decoded?.slice(); }

  receive(frame: Uint8Array): boolean {
    const parsed = parseFrame(frame);
    const { sequence, count, length, size, checksum } = parsed;
    if (this.metadata && (this.metadata.count !== count || this.metadata.length !== length ||
        this.metadata.size !== size || this.metadata.checksum !== checksum)) {
      throw new Error("Frame belongs to another message; reset the decoder first");
    }
    if (this.isComplete) return false;
    const equation = { coefficients: coefficients(sequence, count), data: parsed.data };
    let pivot = -1;
    for (let i = 0; i < count; i++) {
      if (!equation.coefficients[i]) continue;
      const row = this.rows.get(i);
      if (row) {
        xor(equation.coefficients, row.coefficients);
        xor(equation.data, row.data);
      } else {
        pivot = i;
        break;
      }
    }
    if (pivot < 0) return false;
    this.metadata ??= { count, length, size, checksum };
    this.rows.set(pivot, equation);
    if (this.rows.size === count) {
      const message = new Uint8Array(count * size);
      for (let i = count - 1; i >= 0; i--) {
        const row = this.rows.get(i)!;
        const fragment = row.data.slice();
        for (let j = i + 1; j < count; j++) {
          if (row.coefficients[j]) xor(fragment, message.subarray(j * size, (j + 1) * size));
        }
        message.set(fragment, i * size);
      }
      const decoded = message.slice(0, length);
      if (crc32(decoded) !== checksum || message.subarray(length).some(byte => byte !== 0)) {
        this.rows.delete(pivot);
        throw new Error("Reconstructed message checksum or padding mismatch; reset may be required");
      }
      this.decoded = decoded;
    }
    return true;
  }

  reset(): void { this.rows.clear(); this.decoded = undefined; this.metadata = undefined; }
}
