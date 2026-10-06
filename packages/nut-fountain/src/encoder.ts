import { FountainEncoder as BinaryEncoder } from './core.js';
import { UrEncoder } from './internal/ur/encoder.js';

export type EncoderMode = 'binary' | 'compatibility' | 'ur';
export type EncoderOptions = {
  fragmentSize?: number;
  mode?: EncoderMode;
  /** Maximum UR fragment size, before Bytewords/CBOR overhead. Defaults to fragmentSize. */
  urFragmentSize?: number;
  /** Alternate serialization of the same message, e.g. UTF-8 cashuB for older wallets. */
  urPayload?: Uint8Array;
};

/** Binary output by default; compatibility mode alternates NF₁, UR₁, NF₂, UR₂, … */
export class FountainEncoder {
  readonly mode: EncoderMode;
  private readonly binary?: BinaryEncoder;
  private readonly ur?: UrEncoder;
  private nextBinary = true;

  constructor(message: Uint8Array, options: EncoderOptions = {}) {
    if (!(message instanceof Uint8Array)) throw new TypeError('Message must be a Uint8Array');
    this.mode = options.mode ?? 'binary';
    if (!['binary', 'compatibility', 'ur'].includes(this.mode)) throw new TypeError('Unknown encoder mode');
    if (this.mode !== 'ur') this.binary = new BinaryEncoder(message, options);
    if (this.mode !== 'binary') {
      this.ur = new UrEncoder(options.urPayload ?? message, options.urFragmentSize ?? options.fragmentSize ?? 128);
    }
  }

  /** NF source count in binary/compatibility mode; UR source count in UR-only mode. */
  get fragmentCount(): number { return this.binary?.fragmentCount ?? this.ur!.fragmentCount; }
  get urFragmentCount(): number | undefined { return this.ur?.fragmentCount; }

  /** NF bytes or uppercase ASCII UR bytes. Each format advances only when emitted. */
  nextFrame(): Uint8Array {
    if (this.mode === 'binary') return this.binary!.nextFrame();
    if (this.mode === 'ur') return new TextEncoder().encode(this.ur!.nextPart());
    const frame = this.nextBinary ? this.binary!.nextFrame() : new TextEncoder().encode(this.ur!.nextPart());
    this.nextBinary = !this.nextBinary;
    return frame;
  }
}
