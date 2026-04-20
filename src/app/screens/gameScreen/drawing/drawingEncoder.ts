export const ENC_W = 200;
export const ENC_H = 288; // 200 * (720 / 500)

export async function encodeInkLayer(source: HTMLCanvasElement, boardBg: number): Promise<string> {
  const tmp = document.createElement('canvas');
  tmp.width = ENC_W;
  tmp.height = ENC_H;
  const ctx = tmp.getContext('2d')!;
  ctx.drawImage(source, 0, 0, ENC_W, ENC_H);
  const { data } = ctx.getImageData(0, 0, ENC_W, ENC_H);

  const bits = floydSteinberg(data, ENC_W, ENC_H, boardBg);
  const runs = rleEncode(bits, ENC_W * ENC_H);
  const packed = packVarints(runs);
  const compressed = await deflateData(packed);
  return uint8ToBase64(compressed);
}

// Ink pixels get remapped to this gray level so dithering creates halftone texture
// instead of solid black fill. 64 ≈ 75% ink coverage after dithering.
const INK_LEVEL = 64;

function pixelToGray(r: number, g: number, b: number, a: number, bgR: number, bgG: number, bgB: number): number {
  if (a < 16) return 255;
  // Eraser draws board background color → force pure white so it's cleanly subtracted
  if (Math.abs(r - bgR) < 30 && Math.abs(g - bgG) < 30 && Math.abs(b - bgB) < 30) return 255;
  // Composite ink over white paper
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const composited = lum + (255 - lum) * (1 - a / 255);
  // Remap dark range [0,128] → [INK_LEVEL,128] so stroke bodies get dithered texture
  return composited < 128 ? INK_LEVEL + (composited / 128) * (128 - INK_LEVEL) : composited;
}

function floydSteinberg(data: Uint8ClampedArray, w: number, h: number, boardBg: number): Uint8Array {
  const bgR = (boardBg >> 16) & 0xff;
  const bgG = (boardBg >> 8) & 0xff;
  const bgB = boardBg & 0xff;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = pixelToGray(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3], bgR, bgG, bgB);
  }

  const bits = new Uint8Array(Math.ceil((w * h) / 8));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const neu = old < 128 ? 0 : 255;
      const err = old - neu;
      if (neu === 0) bits[i >> 3] |= 1 << (i & 7);
      if (x + 1 < w) gray[i + 1] += err * (7 / 16);
      if (y + 1 < h) {
        if (x > 0) gray[i + w - 1] += err * (3 / 16);
        gray[i + w] += err * (5 / 16);
        if (x + 1 < w) gray[i + w + 1] += err * (1 / 16);
      }
    }
  }
  return bits;
}

function rleEncode(bits: Uint8Array, totalPixels: number): number[] {
  const runs: number[] = [];
  let current = 0;
  let count = 0;
  for (let i = 0; i < totalPixels; i++) {
    const bit = (bits[i >> 3] >> (i & 7)) & 1;
    if (bit === current) {
      count++;
    } else {
      runs.push(count);
      current = bit;
      count = 1;
    }
  }
  runs.push(count);
  return runs;
}

function packVarints(runs: number[]): Uint8Array {
  const out: number[] = [];
  for (const v of runs) {
    let n = v;
    while (n >= 0x80) {
      out.push((n & 0x7f) | 0x80);
      n >>= 7;
    }
    out.push(n);
  }
  return new Uint8Array(out);
}

async function deflateData(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  // fire-and-forget: write + close run concurrently with the read below
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

function uint8ToBase64(data: Uint8Array): string {
  let s = '';
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
  return btoa(s);
}

// --- Decoder ---

export async function decodeInkLayer(base64: string): Promise<HTMLCanvasElement> {
  const compressed = base64ToUint8Array(base64);
  const packed = await inflateData(compressed);
  const runs = unpackVarints(packed);
  const bits = rleDecode(runs, ENC_W * ENC_H);
  return bitsToCanvas(bits, ENC_W, ENC_H);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function inflateData(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function unpackVarints(data: Uint8Array): number[] {
  const runs: number[] = [];
  let i = 0;
  while (i < data.length) {
    let value = 0;
    let shift = 0;
    while (i < data.length) {
      const byte = data[i++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if ((byte & 0x80) === 0) break;
    }
    runs.push(value);
  }
  return runs;
}

function rleDecode(runs: number[], totalPixels: number): Uint8Array {
  const bits = new Uint8Array(Math.ceil(totalPixels / 8));
  let pixel = 0;
  let current = 0;
  for (const run of runs) {
    if (current === 1) {
      for (let j = 0; j < run && pixel < totalPixels; j++, pixel++) {
        bits[pixel >> 3] |= 1 << (pixel & 7);
      }
    } else {
      pixel += run;
    }
    current ^= 1;
  }
  return bits;
}

function bitsToCanvas(bits: Uint8Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const ink = (bits[i >> 3] >> (i & 7)) & 1;
    const v = ink ? 0 : 255;
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
