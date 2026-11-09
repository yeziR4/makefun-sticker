// main.ts — makefun-sticker-01: renders a terminal-window sticker to /output/entry.png.
// Pure stdlib: zlib for the PNG deflate, no dependencies, deterministic output.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const S = 1024;

type RGB = [number, number, number];

const BG: RGB = [30, 31, 42];
const BG_LIGHT: RGB = [44, 46, 62];
const TITLEBAR: RGB = [52, 54, 72];
const WHITE: RGB = [240, 244, 242];
const MINT: RGB = [62, 207, 142];
const MINT_DARK: RGB = [34, 158, 105];
const RED: RGB = [255, 95, 86];
const YELLOW: RGB = [255, 189, 46];
const GREEN: RGB = [39, 201, 63];
const BLUE: RGB = [39, 117, 202];
const BLUE_LIGHT: RGB = [102, 169, 240];
const DIM: RGB = [130, 138, 156];

const SS = 3;
const W = S * SS;
const px: Float64Array = new Float64Array(W * W * 4); // r,g,b,a per supersampled pixel

function blend(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= W || a <= 0) return;
  const i = (y * W + x) * 4;
  const na = a + px[i + 3]! * (1 - a);
  if (na <= 0) return;
  px[i] = (c[0] * a + px[i]! * px[i + 3]! * (1 - a)) / na;
  px[i + 1] = (c[1] * a + px[i + 1]! * px[i + 3]! * (1 - a)) / na;
  px[i + 2] = (c[2] * a + px[i + 2]! * px[i + 3]! * (1 - a)) / na;
  px[i + 3] = na;
}

function fillRect(x0: number, y0: number, w: number, h: number, c: RGB, alpha = 1): void {
  const X0 = Math.max(0, Math.floor(x0 * SS));
  const X1 = Math.min(W - 1, Math.ceil((x0 + w) * SS));
  const Y0 = Math.max(0, Math.floor(y0 * SS));
  const Y1 = Math.min(W - 1, Math.ceil((y0 + h) * SS));
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      blend(x, y, c, alpha);
    }
  }
}

function fillRoundRect(x0: number, y0: number, w: number, h: number, r: number, c: RGB, alpha = 1): void {
  const X0 = Math.max(0, Math.floor(x0 * SS) - 2);
  const X1 = Math.min(W - 1, Math.ceil((x0 + w) * SS) + 2);
  const Y0 = Math.max(0, Math.floor(y0 * SS) - 2);
  const Y1 = Math.min(W - 1, Math.ceil((y0 + h) * SS) + 2);
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

function fillCircle(cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
  const X0 = Math.max(0, Math.floor((cx - r) * SS));
  const X1 = Math.min(W - 1, Math.ceil((cx + r) * SS));
  const Y0 = Math.max(0, Math.floor((cy - r) * SS));
  const Y1 = Math.min(W - 1, Math.ceil((cy + r) * SS));
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const dx = (x + 0.5) / SS - cx;
      const dy = (y + 0.5) / SS - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const cov = Math.min(1, Math.max(0, r - d + 0.5));
      blend(x, y, c, cov * alpha);
    }
  }
}

/** A 5x7 pixel font for the prompt and output lines. */
const FONT: Record<string, string[]> = {
  a: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  b: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  c: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  d: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  e: ['01110', '10001', '10001', '11111', '10000', '10001', '01110'],
  f: ['00111', '01000', '01000', '11110', '01000', '01000', '01000'],
  g: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  i: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  k: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  l: ['01000', '01000', '01000', '01000', '01000', '01000', '01110'],
  m: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  n: ['10010', '11010', '10110', '10010', '10010', '10010', '10010'],
  o: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  p: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  r: ['11100', '10010', '11100', '10100', '10010', '10010', '10001'],
  s: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  t: ['11110', '00100', '00100', '00100', '00100', '00100', '00110'],
  u: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  v: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  w: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  $: ['00100', '01111', '11000', '01110', '00011', '11110', '00100'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  6: ['01110', '10001', '10000', '11110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '>': ['01000', '00100', '00010', '00100', '01000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

function drawText(text: string, x0: number, y0: number, scale: number, c: RGB): void {
  let cx = x0;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (glyph !== undefined) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row]![col] === '1') fillRoundRect(cx + col * scale, y0 + row * scale, scale, scale, scale * 0.3, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function clear(): void {
  px.fill(0);
}

function render(): void {
  clear();

  // --- die-cut white border and the terminal body ---
  fillRoundRect(52, 52, 920, 920, 96, WHITE);
  fillRoundRect(84, 84, 856, 856, 72, BG);

  // --- title bar with traffic lights ---
  fillRoundRect(84, 84, 856, 130, 72, TITLEBAR);
  fillRect(84, 170, 856, 44, TITLEBAR);
  fillCircle(160, 149, 20, RED);
  fillCircle(224, 149, 20, YELLOW);
  fillCircle(288, 149, 20, GREEN);

  // --- terminal lines ---
  const lineH = 88;
  const x0 = 150;
  const right = 852; // values end here
  const labelScale = 8;
  const charW = 6 * labelScale;

  // prompt: $ make fun
  let y = 286;
  drawText('$', x0, y, 12, MINT);
  drawText('make fun', x0 + 90, y, 12, WHITE);
  y += lineH;

  // output rows: label left, value right-aligned
  const row = (label: string, value: string, color: RGB): void => {
    drawText(label, x0, y, labelScale, DIM);
    const vx = right - value.length * charW;
    drawText(value, vx, y, labelScale, color);
    y += lineH;
  };
  row('deployed', 'done', MINT);
  row('bounties', '6', MINT);
  row('reward', '4.9 usdc', BLUE_LIGHT);

  // next prompt with a block cursor
  drawText('$', x0, y, 12, MINT);
  fillRoundRect(x0 + 90, y - 8, 70, 90, 10, WHITE, 0.9);

  // --- USDC coin sticker peeking from the corner ---
  const coinX = 824;
  const coinY = 830;
  fillCircle(coinX, coinY, 70, BLUE);
  fillCircle(coinX, coinY, 57, BLUE_LIGHT);
  fillCircle(coinX, coinY, 47, BLUE);
  fillRoundRect(coinX - 7, coinY - 35, 14, 70, 7, WHITE);
  fillRoundRect(coinX - 25, coinY - 22, 50, 13, 6, WHITE);
  fillRoundRect(coinX - 25, coinY + 9, 50, 13, 6, WHITE);
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
  const raw = Buffer.alloc(S * (S * 4 + 1));
  let o = 0;
  for (let y = 0; y < S; y++) {
    raw[o++] = 0;
    for (let x = 0; x < S; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
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
  ihdr[8] = 8;
  ihdr[9] = 6;
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
