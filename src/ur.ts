import URDecoder from '@gandlaf21/bc-ur/dist/lib/es6/urDecoder.js';

const MAX_MESSAGE_BYTES = 1_048_576;
const MAX_PART_CHARACTERS = 131_072;
const MAX_FRAGMENT_COUNT = 1024;
const MAX_RECEIVED_PARTS = 8192;
const MAX_RECEIVED_BYTES = 16 * MAX_MESSAGE_BYTES;

const isUint32 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

/**
 * Reads complete ur:bytes strings containing a CBOR byte string.
 *
 * Bounds: 1 MiB wrapped message, 1024 source fragments, 131072 characters per
 * input, 8192 distinct parts and 16 MiB cumulative fragment input per session.
 * Reset to abandon a session or after reaching a bound. No UR encoder is exposed.
 */
export class UrDecoder {
  #decoder = new URDecoder();
  #result: Uint8Array | undefined;
  #received = new Set<number>();
  #receivedBytes = 0;
  #session: string | undefined;

  get isComplete(): boolean { return this.#result !== undefined; }
  get result(): Uint8Array | undefined { return this.#result?.slice(); }

  reset(): void {
    this.#decoder = new URDecoder();
    this.#result = undefined;
    this.#received.clear();
    this.#receivedBytes = 0;
    this.#session = undefined;
  }

  /** True for an accepted new part, false for invalid, duplicate or foreign input. */
  receive(ur: string): boolean {
    if (this.isComplete || typeof ur !== 'string' || ur.length > MAX_PART_CHARACTERS) return false;
    const normalized = ur.toLowerCase();
    try {
      const [type, components] = URDecoder.parse(normalized);
      if (type !== 'bytes') return false;
      if (components.length === 1) {
        if (this.#session !== undefined) return false;
        const decoded = URDecoder.decode(normalized);
        if (decoded.cbor.length > MAX_MESSAGE_BYTES) return false;
        const payload: unknown = decoded.decodeCBOR();
        if (!(payload instanceof Uint8Array)) return false;
        this.#result = new Uint8Array(payload);
        return true;
      }
      if (components.length !== 2 || !/^[1-9][0-9]*-[1-9][0-9]*$/.test(components[0]!)) return false;
      const fields: unknown = URDecoder.decode(`ur:bytes/${components[1]}`).decodeCBOR();
      if (!Array.isArray(fields) || fields.length !== 5) return false;
      const [sequence, count, length, checksum, fragment]: unknown[] = fields;
      if (!isUint32(sequence) || sequence === 0 || !isUint32(count) || count === 0 ||
          count > MAX_FRAGMENT_COUNT || !isUint32(length) || length === 0 ||
          length > MAX_MESSAGE_BYTES || !isUint32(checksum) ||
          !(fragment instanceof Uint8Array) || fragment.length === 0 ||
          length > count * fragment.length || length <= (count - 1) * fragment.length ||
          components[0] !== `${sequence}-${count}`) return false;
      const session = `${count}:${length}:${checksum}:${fragment.length}`;
      if ((this.#session !== undefined && this.#session !== session) ||
          this.#received.has(sequence) || this.#received.size >= MAX_RECEIVED_PARTS ||
          this.#receivedBytes + fragment.length > MAX_RECEIVED_BYTES) return false;
      const accepted = this.#decoder.receivePart(ur);
      if (!accepted) return false;
      this.#session = session;
      this.#received.add(sequence);
      this.#receivedBytes += fragment.length;
      if (this.#decoder.isError()) {
        this.reset();
        return false;
      }
      if (this.#decoder.isSuccess()) {
        const result: unknown = this.#decoder.resultUR().decodeCBOR();
        if (!(result instanceof Uint8Array)) {
          this.reset();
          return false;
        }
        this.#result = new Uint8Array(result);
      }
      return true;
    } catch {
      // A malformed reconstructed payload must not strand the reference decoder
      // in its completed state. Invalid individual frames leave valid work intact.
      if (this.#decoder.isComplete() || this.#decoder.isError()) this.reset();
      return false;
    }
  }
}
