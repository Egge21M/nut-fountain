import jsQR from 'jsqr';

/** Preserve arbitrary QR byte segments; converting through text would corrupt binary frames. */
export function readQrPixels(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array | undefined {
  const code = jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
  return code ? new Uint8Array(code.binaryData) : undefined;
}
