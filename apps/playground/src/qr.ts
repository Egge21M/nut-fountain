import QRCode from 'qrcode';
import { readQrPixels } from './qrDecode';
export { readQrPixels } from './qrDecode';

export function createFrameQr(frame: Uint8Array) {
  // Uppercase UR uses QR's alphanumeric alphabet; NF must stay raw binary.
  const isUr = frame[0] === 0x55 && frame[1] === 0x52 && frame[2] === 0x3a;
  return QRCode.create(isUr
    ? [{ mode: 'alphanumeric', data: new TextDecoder().decode(frame) }]
    : [{ mode: 'byte', data: frame }], { errorCorrectionLevel: 'M' });
}

export function drawFrame(canvas: HTMLCanvasElement, frame: Uint8Array): { version: number; modules: number } {
  const qr = createFrameQr(frame);
  const scale = 6, quiet = 4;
  canvas.width = canvas.height = (qr.modules.size + quiet * 2) * scale;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#102319';
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) {
    if (qr.modules.get(y, x)) context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
  }
  return { version: qr.version, modules: qr.modules.size };
}


export function readCanvas(canvas: HTMLCanvasElement): Uint8Array | undefined {
  const pixels = canvas.getContext('2d', { willReadFrequently: true })!
    .getImageData(0, 0, canvas.width, canvas.height);
  return readQrPixels(pixels.data, pixels.width, pixels.height);
}

export async function readQrImage(file: File): Promise<Uint8Array | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return readCanvas(canvas);
  } finally { URL.revokeObjectURL(url); }
}
