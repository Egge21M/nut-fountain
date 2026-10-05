import QRCode from 'qrcode';
import jsQR from 'jsqr';

export function createFrameQr(frame: Uint8Array) {
  return QRCode.create([{ mode: 'byte', data: frame }], { errorCorrectionLevel: 'M' });
}

export function drawFrame(canvas: HTMLCanvasElement, frame: Uint8Array): void {
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
}

/** jsQR.binaryData retains arbitrary bytes; its text field would corrupt them. */
export function readQrPixels(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array | undefined {
  const code = jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
  return code ? new Uint8Array(code.binaryData) : undefined;
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
