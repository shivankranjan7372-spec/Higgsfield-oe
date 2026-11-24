import "server-only";

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { aspectNumber } from "@/registry/logic";
import type { MediaType, Values } from "@/registry/types";
import { wavFromPcm } from "./media";

/**
 * The mock provider (`TREG_MODE=mock`, or no token set). It stands in for every model:
 * the whole job pipeline runs for real (queue, credits, files, feed), but the result is
 * made locally and costs nothing. Images are painted in code, clips come from
 * `mock-media/`, audio is synthesised.
 *
 * A prompt containing `[fail]` fails on purpose, to exercise the error path.
 */

export interface MockInput {
  output: MediaType;
  prompt: string;
  params: Values;
  count: number;
  /** Changes the picture between jobs that share a prompt. */
  seed: string;
}

export function mockDelayMs(output: MediaType): number {
  const fixed = Number(process.env.MOCK_DELAY_MS);
  if (Number.isFinite(fixed) && fixed >= 0 && process.env.MOCK_DELAY_MS) return fixed;
  return output === "video" ? 6000 : output === "image" ? 2500 : 2000;
}

export function mockShouldFail(prompt: string): boolean {
  return /\[fail\]/i.test(prompt);
}

export async function mockMedia(input: MockInput): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 0; i < Math.max(1, input.count); i++) {
    const rand = rng(hash(`${input.prompt}|${input.seed}|${i}`));
    if (input.output === "image") out.push(paint(aspectNumber(input.params.aspect, 1), rand));
    else if (input.output === "video") out.push(clip(aspectNumber(input.params.aspect, 16 / 9), rand));
    else out.push(tone(input, rand));
  }
  return out;
}

/* --------------------------------- numbers --------------------------------- */

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded generator, so the same prompt always paints the same picture. */
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------- image ---------------------------------- */

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  let c = 0xffffffff;
  for (let i = 0; i < body.length; i++) c = CRC[(c ^ body[i]) & 0xff] ^ (c >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

// Ordered dither. It hides banding in 8-bit gradients and still compresses well.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

/** A soft mesh gradient as a PNG. No image library needed. */
function paint(ratio: number, rand: () => number): Buffer {
  const long = 1024;
  const width = ratio >= 1 ? long : Math.max(64, Math.round((long * ratio) / 8) * 8);
  const height = ratio >= 1 ? Math.max(64, Math.round(long / ratio / 8) * 8) : long;

  const hue = rand() * 360;
  const spread = 30 + rand() * 80;
  const points = [
    { x: rand() * 0.4, y: rand() * 0.4, c: hsl(hue, 0.7, 0.12) },
    { x: 0.6 + rand() * 0.4, y: rand() * 0.5, c: hsl((hue + spread) % 360, 0.75, 0.45) },
    { x: rand() * 0.5, y: 0.6 + rand() * 0.4, c: hsl((hue + spread * 2) % 360, 0.8, 0.6) },
    { x: 0.5 + rand() * 0.5, y: 0.5 + rand() * 0.5, c: hsl((hue + 180 + spread) % 360, 0.85, 0.72) },
    { x: 0.3 + rand() * 0.4, y: 0.3 + rand() * 0.4, c: hsl((hue + spread / 2) % 360, 0.6, 0.28) },
  ];

  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  const scale = Math.max(width, height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    raw[row] = 0; // filter: none
    const py = y / scale;
    for (let x = 0; x < width; x++) {
      const px = x / scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let sum = 0;
      for (const p of points) {
        const dx = px - (p.x * width) / scale;
        const dy = py - (p.y * height) / scale;
        const w = 1 / (dx * dx + dy * dy + 0.012) ** 1.6;
        r += p.c[0] * w;
        g += p.c[1] * w;
        b += p.c[2] * w;
        sum += w;
      }
      const d = BAYER[(y & 3) * 4 + (x & 3)];
      const at = row + 1 + x * 3;
      raw[at] = Math.max(0, Math.min(255, Math.round(r / sum + d)));
      raw[at + 1] = Math.max(0, Math.min(255, Math.round(g / sum + d)));
      raw[at + 2] = Math.max(0, Math.min(255, Math.round(b / sum + d)));
    }
  }

  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; // bits per channel
  head[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------------------------- video ---------------------------------- */

/** Picks one of the short gradient clips in `mock-media/` that fits the aspect ratio. */
function clip(ratio: number, rand: () => number): Buffer {
  const shape = ratio > 1.2 ? "16x9" : ratio < 0.84 ? "9x16" : "1x1";
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), "mock-media", `video-${shape}-${rand() < 0.5 ? "a" : "b"}.mp4`);
  if (!fs.existsSync(file)) throw new Error(`Mock clip missing: ${file}. Start the app from its root folder.`);
  return fs.readFileSync(file);
}

/* ---------------------------------- audio ---------------------------------- */

/** A few plucked notes as a WAV. Longer text makes a longer take. */
function tone(input: MockInput, rand: () => number): Buffer {
  const rate = 22_050;
  const asked = Number(input.params.duration);
  const seconds = Number.isFinite(asked) && asked > 0 ? Math.min(30, asked) : Math.min(8, Math.max(2, input.prompt.length / 18));
  const total = Math.floor(rate * seconds);
  const samples = new Float32Array(total);

  // A pentatonic scale never sounds wrong, whatever the seed picks.
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const root = 196 * 2 ** (Math.floor(rand() * 6) / 12);
  const step = 0.28 + rand() * 0.14;
  for (let t = 0; t < seconds - 0.2; t += step) {
    const freq = root * 2 ** (scale[Math.floor(rand() * scale.length)] / 12);
    const start = Math.floor(t * rate);
    const length = Math.min(total - start, Math.floor(rate * 1.6));
    for (let i = 0; i < length; i++) {
      const s = i / rate;
      const env = Math.min(1, s * 200) * Math.exp(-s * 3.2);
      samples[start + i] += env * (Math.sin(2 * Math.PI * freq * s) * 0.6 + Math.sin(4 * Math.PI * freq * s) * 0.22 + Math.sin(6 * Math.PI * freq * s) * 0.08);
    }
  }

  let peak = 0.0001;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const pcm = Buffer.alloc(total * 2);
  const fade = rate * 0.15;
  for (let i = 0; i < total; i++) {
    const out = (samples[i] / peak) * 0.8 * Math.min(1, (total - i) / fade);
    pcm.writeInt16LE(Math.round(out * 32767), i * 2);
  }

  return wavFromPcm(pcm, rate);
}
