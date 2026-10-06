import { FountainDecoder } from './core.js';
import { UrDecoder } from './ur.js';

export type DecoderFormat = 'binary' | 'ur';

/** Routes scanned bytes or UR text; optionally races independent NF and UR decoders. */
export class AutoDecoder {
  #decoder: FountainDecoder | UrDecoder | undefined;
  #format: DecoderFormat | undefined;
  #decoders = new Map<DecoderFormat, FountainDecoder | UrDecoder>();
  readonly #allowMixedFormats: boolean;

  constructor(options: { allowMixedFormats?: boolean } = {}) {
    this.#allowMixedFormats = options.allowMixedFormats ?? false;
  }

  get format(): DecoderFormat | undefined { return this.#format; }
  get isComplete(): boolean { return this.#decoder?.isComplete ?? false; }
  get result(): Uint8Array | undefined { return this.#decoder?.result; }
  get independentFrames(): number { return this.#decoder?.independentFrames ?? 0; }
  /** Total retained rank across formats, for counting useful scan events. */
  get totalIndependentFrames(): number {
    return this.#allowMixedFormats
      ? [...this.#decoders.values()].reduce((sum, decoder) => sum + decoder.independentFrames, 0)
      : this.independentFrames;
  }
  get fragmentCount(): number | undefined { return this.#decoder?.fragmentCount; }
  get progress(): number { return this.#decoder?.progress ?? 0; }

  reset(): void { this.#decoder = undefined; this.#format = undefined; this.#decoders.clear(); }

  /**
   * By default selects a format on its first accepted frame. Mixed mode keeps
   * both formats independently and reports the first completed reconstruction.
   * Unknown prefixes return false. Switching formats requires reset(). Binary
   * validation errors and invalid UTF-8 in UR bytes throw; invalid UR text returns
   * false. The boolean is acceptance, not completion or guaranteed progress.
   */
  receive(input: Uint8Array | string): boolean {
    // The first completed reconstruction wins and stays stable until reset.
    if (this.#allowMixedFormats && this.isComplete) return false;
    let format: DecoderFormat | undefined;
    if (typeof input === 'string') {
      if (/^ur:/i.test(input)) format = 'ur';
    } else if (input instanceof Uint8Array) {
      if ((input[0] === 0x75 || input[0] === 0x55) &&
          (input[1] === 0x72 || input[1] === 0x52) && input[2] === 0x3a) format = 'ur';
      else if (input[0] === 0x4e && input[1] === 0x46) format = 'binary';
    } else {
      throw new TypeError('Expected scanned bytes or UR text');
    }
    if (!format) return false;
    if (!this.#allowMixedFormats && this.#format && this.#format !== format) {
      throw new Error('Frame belongs to another message format; reset the decoder first');
    }
    const existing = this.#allowMixedFormats ? this.#decoders.get(format) : this.#decoder;
    const decoder = existing ?? (format === 'ur' ? new UrDecoder() : new FountainDecoder());
    // Only UR is text. Binary frames must never pass through a text codec.
    const accepted = decoder instanceof UrDecoder
      ? decoder.receive(typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input))
      : decoder.receive(input as Uint8Array);
    if (this.#allowMixedFormats) {
      if (accepted) this.#decoders.set(format, decoder);
      // Show the most advanced reconstruction. Never combine the two equation sets.
      this.#decoder = undefined; this.#format = undefined;
      for (const [candidateFormat, candidate] of this.#decoders) {
        if (!this.#decoder || candidate.progress > this.#decoder.progress) {
          this.#decoder = candidate; this.#format = candidateFormat;
        }
      }
    } else if (accepted) { this.#decoder = decoder; this.#format = format; }
    return accepted;
  }
}
