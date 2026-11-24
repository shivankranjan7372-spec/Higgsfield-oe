import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs";
import type { MediaType } from "@/registry/types";

/**
 * Reads what a file is from its bytes. Nothing here trusts a file name or a
 * Content-Type header. Everything works without ffmpeg; when ffmpeg is installed
 * we also get poster frames and the length of compressed audio.
 */

export interface Sniffed {
  mime: string;
  kind: MediaType;
  ext: string;
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

/** Identifies a file from its first bytes. Returns null for anything we do not store. */
export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { mime: "image/png", kind: "image", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image", ext: "jpg" };
  if (ascii(b, 0, 4) === "GIF8") return { mime: "image/gif", kind: "image", ext: "gif" };
  if (ascii(b, 0, 4) === "RIFF") {
    const form = ascii(b, 8, 4);
    if (form === "WEBP") return { mime: "image/webp", kind: "image", ext: "webp" };
    if (form === "WAVE") return { mime: "audio/wav", kind: "audio", ext: "wav" };
    return null;
  }
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", kind: "image", ext: "avif" };
    if (brand === "heic" || brand === "heix" || brand === "mif1") return { mime: "image/heic", kind: "image", ext: "heic" };
    if (brand === "M4A " || brand === "M4B ") return { mime: "audio/mp4", kind: "audio", ext: "m4a" };
    if (brand === "qt  ") return { mime: "video/quicktime", kind: "video", ext: "mov" };
    return { mime: "video/mp4", kind: "video", ext: "mp4" };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", kind: "video", ext: "webm" };
  if (ascii(b, 0, 4) === "OggS") return { mime: "audio/ogg", kind: "audio", ext: "ogg" };
  if (ascii(b, 0, 4) === "fLaC") return { mime: "audio/flac", kind: "audio", ext: "flac" };
  if (ascii(b, 0, 3) === "ID3") return { mime: "audio/mpeg", kind: "audio", ext: "mp3" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    // Frame sync. Layer bits 00 mean AAC in an ADTS stream, anything else is MPEG audio.
    return (b[1] & 0x06) === 0 ? { mime: "audio/aac", kind: "audio", ext: "aac" } : { mime: "audio/mpeg", kind: "audio", ext: "mp3" };
  }
  return null;
}

export interface Size {
  width: number;
  height: number;
}

/** Pixel size of a PNG, JPEG, GIF or WebP, read from the header. */
export function imageSize(b: Buffer, mime: string): Size | null {
  try {
    if (mime === "image/png") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (mime === "image/gif") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    if (mime === "image/webp") {
      const chunk = b.toString("latin1", 12, 16);
      if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
      return null;
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = b[i + 1];
        if (marker === 0xff) {
          i++;
          continue;
        }
        // Start-of-frame markers carry the size. C4, C8 and CC are tables, not frames.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        }
        if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
          i += 2;
          continue;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {
    /* A truncated header: no size. */
  }
  return null;
}

export interface Probe {
  width: number | null;
  height: number | null;
  /** Seconds. */
  duration: number | null;
}

const EMPTY: Probe = { width: null, height: null, duration: null };

/** Length of an uncompressed WAV, from its `fmt ` and `data` chunks. */
export function wavDuration(b: Buffer): number | null {
  try {
    let at = 12;
    let byteRate = 0;
    while (at + 8 <= b.length) {
      const id = b.toString("latin1", at, at + 4);
      const size = b.readUInt32LE(at + 4);
      if (id === "fmt ") byteRate = b.readUInt32LE(at + 16);
      if (id === "data") return byteRate > 0 ? Math.min(size, b.length - at - 8) / byteRate : null;
      at += 8 + size + (size % 2);
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Size and length of an MP4 or MOV, from the `moov` box. Reads box headers only, so large files are cheap. */
export function mp4Probe(file: string): Probe {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, "r");
    const total = fs.fstatSync(fd).size;
    const head = Buffer.alloc(16);
    let pos = 0;
    while (pos + 8 <= total) {
      fs.readSync(fd, head, 0, 16, pos);
      let size = head.readUInt32BE(0);
      let header = 8;
      if (size === 1) {
        size = Number(head.readBigUInt64BE(8));
        header = 16;
      } else if (size === 0) size = total - pos;
      if (size < header) break;
      if (head.toString("latin1", 4, 8) === "moov") {
        const moov = Buffer.alloc(Math.min(size - header, 16_000_000));
        fs.readSync(fd, moov, 0, moov.length, pos + header);
        return readMoov(moov);
      }
      pos += size;
    }
  } catch {
    /* Not a readable MP4. */
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  return EMPTY;
}

function* boxes(b: Buffer): Generator<{ type: string; body: Buffer }> {
  let at = 0;
  while (at + 8 <= b.length) {
    const size = b.readUInt32BE(at);
    if (size < 8 || at + size > b.length) return;
    yield { type: b.toString("latin1", at + 4, at + 8), body: b.subarray(at + 8, at + size) };
    at += size;
  }
}

function readMoov(moov: Buffer): Probe {
  const out: Probe = { ...EMPTY };
  for (const box of boxes(moov)) {
    if (box.type === "mvhd") {
      const v1 = box.body[0] === 1;
      const timescale = box.body.readUInt32BE(v1 ? 20 : 12);
      const length = v1 ? Number(box.body.readBigUInt64BE(24)) : box.body.readUInt32BE(16);
      if (timescale > 0) out.duration = length / timescale;
    }
    if (box.type === "trak" && out.width === null) {
      for (const inner of boxes(box.body)) {
        if (inner.type !== "tkhd") continue;
        // Width and height are the last two 16.16 fixed-point fields.
        const w = inner.body.readUInt32BE(inner.body.length - 8) / 65536;
        const h = inner.body.readUInt32BE(inner.body.length - 4) / 65536;
        if (w > 0 && h > 0) {
          out.width = Math.round(w);
          out.height = Math.round(h);
        }
      }
    }
  }
  return out;
}

/* --------------------------------- ffmpeg --------------------------------- */

function exec(bin: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, maxBuffer: 4_000_000 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

let ffmpegReady: Promise<boolean> | undefined;

/** True when ffmpeg and ffprobe are on the PATH. Checked once. */
export function hasFfmpeg(): Promise<boolean> {
  return (ffmpegReady ??= Promise.all([exec("ffmpeg", ["-version"], 5000), exec("ffprobe", ["-version"], 5000)]).then(
    ([a, b]) => a !== null && b !== null,
  ));
}

/** Size and length through ffprobe. Returns nulls when ffprobe is missing or the file is odd. */
export async function ffprobe(file: string): Promise<Probe> {
  if (!(await hasFfmpeg())) return EMPTY;
  const out = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", file], 20_000);
  if (!out) return EMPTY;
  try {
    const parsed = JSON.parse(out) as { format?: { duration?: string }; streams?: { width?: number; height?: number }[] };
    const video = parsed.streams?.find((s) => s.width && s.height);
    const seconds = Number(parsed.format?.duration);
    return { width: video?.width ?? null, height: video?.height ?? null, duration: Number.isFinite(seconds) ? seconds : null };
  } catch {
    return EMPTY;
  }
}

/** Writes a JPEG of an early frame. Returns false when ffmpeg is missing or fails. */
export async function writePoster(video: string, out: string): Promise<boolean> {
  if (!(await hasFfmpeg())) return false;
  const args = ["-y", "-v", "error", "-ss", "0.2", "-i", video, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-q:v", "4", out];
  return (await exec("ffmpeg", args, 30_000)) !== null && fs.existsSync(out);
}

/* ---------------------------------- audio --------------------------------- */

/** Wraps raw PCM in a WAV header. Some speech models return bare samples. */
export function wavFromPcm(pcm: Buffer, sampleRate = 24_000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8, "latin1");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36, "latin1");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
