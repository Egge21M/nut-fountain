import { readQrPixels } from './qrDecode';

export type QrJob = { pixels: Uint8ClampedArray; width: number; height: number };
export type QrReply = { bytes?: Uint8Array; decodeMs: number; failed: boolean };

self.onmessage = ({ data }: MessageEvent<QrJob>) => {
  const started = performance.now();
  let bytes: Uint8Array | undefined;
  let failed = false;
  try { bytes = readQrPixels(data.pixels, data.width, data.height); }
  catch { failed = true; }
  const reply: QrReply = { bytes, decodeMs: performance.now() - started, failed };
  self.postMessage(reply, { transfer: bytes ? [bytes.buffer as ArrayBuffer] : [] });
};
