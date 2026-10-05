import { FountainDecoder } from 'nut-fountain/core';
import { UrDecoder } from 'nut-fountain/ur';

/** One transfer at a time, selected by its first accepted binary or UR frame. */
export class TransferReader {
  #decoder: FountainDecoder | UrDecoder | undefined;
  #format: 'Binary' | 'UR' | undefined;

  get format() { return this.#format; }
  get isComplete() { return this.#decoder?.isComplete ?? false; }
  get result() { return this.#decoder?.result; }
  get independentFrames() { return this.#decoder?.independentFrames ?? 0; }
  get fragmentCount() { return this.#decoder?.fragmentCount; }
  get progress() { return this.#decoder?.progress ?? 0; }

  receive(bytes: Uint8Array): boolean {
    const isUr = (bytes[0] === 0x75 || bytes[0] === 0x55) &&
      (bytes[1] === 0x72 || bytes[1] === 0x52) && bytes[2] === 0x3a;
    const format = isUr ? 'UR' : bytes[0] === 0x4e && bytes[1] === 0x46 ? 'Binary' : undefined;
    if (!format) return false;
    if (this.#format && this.#format !== format) {
      throw new Error('Frame belongs to another message; reset the reader first');
    }
    const decoder = this.#decoder ?? (isUr ? new UrDecoder() : new FountainDecoder());
    // Only UR is text. Raw binary frames must never pass through a text codec.
    const accepted = decoder instanceof UrDecoder
      ? decoder.receive(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      : decoder.receive(bytes);
    if (accepted) { this.#decoder = decoder; this.#format = format; }
    return accepted;
  }
}
