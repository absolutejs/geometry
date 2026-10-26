const MAX_TEXELS = 4_194_304;
function validateSize(width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_TEXELS)
    throw Error('Invalid or oversized alpha source');
}
/** Copy one alpha byte per row-major RGBA8 texel. Does not mutate borrowed pixels. */
export function alphaFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  validateSize(width, height);
  if (!(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4)
    throw Error('Expected tightly packed RGBA8 alpha source');
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]!;
  return alpha;
}
/** Worker/setup-time CPU readback. The caller owns and closes the bitmap.
 * This never closes/detaches the caller's image and never creates a WebGL context. */
export function alphaFromImageBitmap(bitmap: ImageBitmap): Uint8Array {
  if (typeof ImageBitmap === 'undefined' || !(bitmap instanceof ImageBitmap))
    throw Error('Expected an available ImageBitmap');
  validateSize(bitmap.width, bitmap.height);
  if (typeof OffscreenCanvas === 'undefined') throw Error('OffscreenCanvas is unavailable for alpha readback');
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw Error('Canvas2D is unavailable for alpha readback');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return alphaFromRgba(pixels.data, pixels.width, pixels.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
