export const MAX_FRAGMENT_SIZE = 4096;
export const MAX_FRAGMENTS = 256;
export const MAX_MESSAGE_LENGTH = MAX_FRAGMENT_SIZE * MAX_FRAGMENTS;
export const OVERHEAD = 24;

/** CRC-32/ISO-HDLC: reflected polynomial 0xedb88320, init/final xor 0xffffffff. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type Metadata = { count: number; length: number; size: number; checksum: number };

export function parseFrame(frame: Uint8Array): Metadata & { sequence: number; data: Uint8Array } {
  if (!(frame instanceof Uint8Array)) throw new TypeError("Frame must be a Uint8Array");
  if (frame.length <= OVERHEAD || frame.length > OVERHEAD + MAX_FRAGMENT_SIZE) {
    throw new Error("Invalid fountain frame size");
  }
  if (frame[0] !== 0x4e || frame[1] !== 0x46 || frame[2] !== 1 || frame[3] !== 0) {
    throw new Error("Unsupported fountain frame format, version, or flags");
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const sequence = view.getUint32(4);
  const count = view.getUint32(8);
  const length = view.getUint32(12);
  const checksum = view.getUint32(16);
  const size = frame.length - OVERHEAD;
  if (sequence === 0 || count < 1 || count > MAX_FRAGMENTS || length > MAX_MESSAGE_LENGTH ||
      count !== Math.max(1, Math.ceil(length / size))) {
    throw new Error("Invalid fountain frame metadata");
  }
  if (crc32(frame.subarray(0, -4)) !== view.getUint32(frame.length - 4)) {
    throw new Error("Fountain frame checksum mismatch");
  }
  return { sequence, count, length, size, checksum, data: frame.slice(20, -4) };
}
