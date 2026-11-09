// main.ts — makefun-sticker-01: renders a die-cut robot sticker to /output/entry.png.
// Pure stdlib: zlib for the PNG deflate, no dependencies, deterministic output.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const S = 1024; // canvas
const SS = 3; // supersampling factor

type RGB = [number, number, number];

const NAVY: RGB = [24, 34, 58];
const NAVY_LIGHT: RGB = [38, 54, 88];
const MINT: RGB = [62, 207, 142];
const MINT_DARK: RGB = [34, 158, 105];
const WHITE: RGB = [245, 250, 248];
const COIN: RGB = [39, 117, 202];
const COIN_LIGHT: RGB = [102, 169, 240];

const px: Float64Array = new Float64Array(S * SS * (S * SS) * 4); // r,g,b,a

function clear(): void {
  px.fill(0);
}

function blend(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= S * SS || y >= S * SS || a <= 0) return;
  const i = (y * S * SS + x) * 4;
  const na = a + px[i + 3]! * (1 - a);
  if (na <= 0) return;
  px[i] = (c[0] * a + px[i]! * px[i + 3]! * (1 - a)) / na;
  px[i + 1] = (c[1] * a + px[i + 1]! * px[i + 3]! * (1 - a)) / na;
  px[i + 2] = (c[2] * a + px[i + 2]! * px[i + 3]! * (1 - a)) / na;
  px[i + 3] = na;
}

function fillCircle(cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
  const x0 = Math.max(0, Math.floor((cx - r) * SS));
  const x1 = Math.min(S * SS - 1, Math.ceil((cx + r) * SS));
  const y0 = Math.max(0, Math.floor((cy - r) * SS));
  const y1 = Math.min(S * SS - 1, Math.ceil((cy + r) * SS));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5) / SS - cx;
      const dy = (y + 0.5) / SS - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const cov = Math.min(1, Math.max(0, r - d + 0.5));
      blend(x, y, c, cov * alpha);
    }
  }
}

function ring(cx: number, cy: number, rOuter: number, rInner: number, c: RGB, alpha = 1): void {
  fillCircle(cx, cy, rOuter, c, alpha);
  fillCircle(cx, cy, rInner, c, 0); // punch through: restores what was under by re-blending with 0 alpha? no —
}

/** Rounded rectangle path fill. */
function fillRoundRect(x0: number, y0: number, w: number, h: number, r: number, c: RGB, alpha = 1): void {
  const X0 = Math.max(0, Math.floor(x0 * SS) - 2);
  const X1 = Math.min(S * SS - 1, Math.ceil((x0 + w) * SS) + 2);
  const Y0 = Math.max(0, Math.floor(y0 * SS) - 2);
  const Y1 = Math.min(S * SS - 1, Math.ceil((y0 + h) * SS) + 2);
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const px_ = (x + 0.5) / SS;
      const py = (y + 0.5) / SS;
      const qx = Math.max(x0 + r - px_, px_ - (x0 + w - r), 0);
      const qy = Math.max(y0 + r - py, py - (y0 + h - r), 0);
      const d = Math.sqrt(qx * qx + qy * qy);
      const cov = Math.min(1, Math.max(0, r - d + 0.5));
      if (cov > 0) blend(x, y, c, cov * alpha);
    }
  }
}

/** Filled convex polygon. */
function fillPoly(pts: Array<[number, number]>, c: RGB, alpha = 1): void {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  const Y0 = Math.max(0, Math.floor(minY * SS));
  const Y1 = Math.min(S * SS - 1, Math.ceil(maxY * SS));
  const X0 = Math.max(0, Math.floor(minX * SS));
  const X1 = Math.min(S * SS - 1, Math.ceil(maxX * SS));
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const px_ = (x + 0.5) / SS;
      const py = (y + 0.5) / SS;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px_ < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) blend(x, y, c, alpha);
    }
  }
}

/** A 5x7 pixel font, rows top to bottom, 1 = ink. Covers the letters we need. */
const FONT: Record<string, string[]> = {
  a: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  c: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  e: ['01110', '10001', '10001', '11111', '10000', '10001', '01110'],
  f: ['00111', '01000', '01000', '11110', '01000', '01000', '01000'],
  k: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  m: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  n: ['10010', '11010', '10110', '10010', '10010', '10010', '10010'],
  u: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  $: ['00100', '01111', '11000', '01110', '00011', '11110', '00100'],
};

function drawText(text: string, x0: number, y0: number, scale: number, c: RGB): number {
  let cx = x0;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (glyph === undefined) {
      cx += 6 * scale;
      continue;
    }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row]![col] === '1') {
          fillRoundRect(cx + col * scale, y0 + row * scale, scale, scale, scale * 0.28, c);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx - x0;
}

function render(): void {
  clear();
  const cx = S / 2;

  // --- badge: white die-cut border, then a navy rounded panel ---
  fillRoundRect(72, 60, 880, 904, 140, WHITE);
  fillRoundRect(112, 100, 800, 824, 116, NAVY);

  // --- robot head ---
  // antenna
  fillRoundRect(cx - 12, 172, 24, 90, 12, NAVY_LIGHT);
  fillCircle(cx, 160, 34, MINT);
  fillCircle(cx, 160, 14, WHITE);

  // head: rounded rectangle
  fillRoundRect(cx - 250, 250, 500, 380, 96, NAVY_LIGHT);
  // visor
  fillRoundRect(cx - 210, 300, 420, 220, 76, [12, 18, 32]);
  // eyes
  fillCircle(cx - 105, 410, 58, MINT);
  fillCircle(cx + 105, 410, 58, MINT);
  fillCircle(cx - 118, 396, 20, WHITE);
  fillCircle(cx + 92, 396, 20, WHITE);
  // smile: a thin mint bar
  fillRoundRect(cx - 60, 560, 120, 18, 9, MINT);
  // ears
  fillRoundRect(cx - 282, 380, 34, 120, 16, MINT_DARK);
  fillRoundRect(cx + 248, 380, 34, 120, 16, MINT_DARK);

  // --- wordmark, centered under the head ---
  const scale = 11;
  const text = 'make.fun';
  const w = text.length * 6 * scale;
  drawText(text, cx - w / 2, 680, scale, WHITE);

  // --- USDC-style coin, tucked into the bottom-right of the panel ---
  const coinX = 812;
  const coinY = 824;
  fillCircle(coinX, coinY, 64, COIN);
  fillCircle(coinX, coinY, 52, COIN_LIGHT);
  fillCircle(coinX, coinY, 42, COIN);
  fillRoundRect(coinX - 7, coinY - 32, 14, 64, 7, WHITE);
  fillRoundRect(coinX - 23, coinY - 20, 46, 12, 6, WHITE);
  fillRoundRect(coinX - 23, coinY + 8, 46, 12, 6, WHITE);

  // sparkles
  fillPoly(
    [
      [250, 190],
      [262, 226],
      [298, 238],
      [262, 250],
      [250, 286],
      [238, 250],
      [202, 238],
      [238, 226],
    ],
    WHITE,
    0.9,
  );
  fillPoly(
    [
      [810, 320],
      [819, 346],
      [845, 355],
      [819, 364],
      [810, 390],
      [801, 364],
      [775, 355],
      [801, 346],
    ],
    MINT,
    0.9,
  );
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function writePng(path: string): void {
  // 4x4 box-downsample of the supersampled canvas to RGBA8.
  const raw = Buffer.alloc(S * (S * 4 + 1));
  let o = 0;
  for (let y = 0; y < S; y++) {
    raw[o++] = 0; // no filter
    for (let x = 0; x < S; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S * SS + (x * SS + sx)) * 4;
          const wa = px[i + 3]!;
          r += px[i]! * wa;
          g += px[i + 1]! * wa;
          b += px[i + 2]! * wa;
          a += wa;
        }
      }
      const n = SS * SS;
      const aa = a / n;
      raw[o++] = aa > 0 ? Math.round(r / a) : 0;
      raw[o++] = aa > 0 ? Math.round(g / a) : 0;
      raw[o++] = aa > 0 ? Math.round(b / a) : 0;
      raw[o++] = Math.round(aa * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
  writeFileSync(path, png);
}

const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(OUTPUT_DIR, { recursive: true });
render();
writePng(`${OUTPUT_DIR}/entry.png`);
console.log('wrote', `${OUTPUT_DIR}/entry.png`);
