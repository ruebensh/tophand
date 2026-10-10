// ─── Video container validation (F-05) ───────────────────────────────────────
// Faqat magic-byte yetarli emas: `ftyp`/EBML imzosi BO'LGAN random/malformed
// body'larni ham rad etish uchun yengil, bounded STRUCTURAL parser. Tashqi
// bog'liqlik (ffprobe/ffmpeg) TALAB QILINMAYDI — bu CI'da ham ishlaydi.
// Tekshiriladi:
//   MP4  : ISO-BMFF box zanjiri (size/containment), brand allowlist (isom/avc1
//          /mp42/silv...), `moov` mavjud, mvhd duration+timescale, tkhd kenglik/
//          balandlik, stsd video codec allowlist (avc1/hvc1/hev1/mp4v/av01).
//   WebM : EBML header, DocType == "webm", Segment, Info/Duration, Video
//          PixelWidth/PixelHeight.
// Limitlar: duration 0.5–180s, tomonlar ≤3840, maydon ≤8.3MP, box/element
// ko'rish cheklangan (bounded work).
//
// Cheklov (infra): aniq codec profile/decompression-bomb'lar uchun server-side
// transcode/ffprobe ham yoqilishi mumkin — bu parser ixtiyoriy qatlam emas,
// MINIMUM daraja.

export interface VideoInfo {
  container: 'mp4' | 'webm';
  durationSec: number;
  width: number;
  height: number;
  codec?: string;
}

const MAX_DURATION_SEC = 180;
const MIN_DURATION_SEC = 0.5;
const MAX_DIM = 3840;
const MAX_PIXELS = 8_294_400; // 3840*2160
const MP4_ALLOWED_BRANDS = ['isom', 'iso2', 'iso4', 'avc1', 'mp41', 'mp42', 'dash', 'silv', 'XAVC'];
const MP4_ALLOWED_VIDEO_CODECS = ['avc1', 'hvc1', 'hev1', 'mp4v', 'av01'];
const MAX_BOX_VISITS = 20_000;

class VideoRejected extends Error {
  status = 400;
  constructor(reason: string) {
    super(`Video yaroqsiz: ${reason}`);
  }
}

function u32(buf: Buffer, off: number): number {
  return buf.readUInt32BE(off);
}

/** 1/2/4 baytli BE unsigned; 8 bayt — Number(bigint) (WebM uchun). */
function readUint(buf: Buffer, off: number, size: number): number {
  if (size === 1) return buf.readUInt8(off);
  if (size === 2) return buf.readUInt16BE(off);
  if (size === 4) return buf.readUInt32BE(off);
  if (size === 8) return Number(buf.readBigUInt64BE(off));
  return 0;
}

interface Mp4Box {
  type: string;
  headerEnd: number; // content boshlanishi
  end: number; // keyingi box boshlanishi
}

/** Bir darajadagi box'larni [start,end) oralig'ida ajratadi. */
function readBoxes(buf: Buffer, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let off = start;
  while (off + 8 <= end) {
    let size = u32(buf, off);
    let headerEnd = off + 8;
    const type = buf.toString('latin1', off + 4, off + 8);
    if (size === 1) {
      // 64-bit largesize
      if (off + 16 > end) throw new VideoRejected('mp4 largesize truncated');
      const hi = u32(buf, off + 8);
      const lo = u32(buf, off + 12);
      size = hi * 0x1_0000_0000 + lo;
      headerEnd = off + 16;
    } else if (size === 0) {
      size = end - off; // box to end of range
    }
    if (size < 8 || off + size > end) throw new VideoRejected(`mp4 box ${type} size oob`);
    boxes.push({ type, headerEnd, end: off + size });
    off += size;
  }
  if (off !== end && end - off > 0) {
    // trailing bytes — kichik bo'lsa e'tiborsiz, chunka qaysidir — rad etmaymiz
  }
  return boxes;
}

function findBox(boxes: Mp4Box[], type: string): Mp4Box | undefined {
  return boxes.find((b) => b.type === type);
}

function parseMp4(buf: Buffer): VideoInfo {
  const top = readBoxes(buf, 0, Math.min(buf.length, 256 * 1024 * 1024));
  const ftyp = top[0];
  if (!ftyp || ftyp.type !== 'ftyp') throw new VideoRejected('ftyp top box emas');
  const brands: string[] = [];
  for (let off = ftyp.headerEnd + 4; off + 4 <= ftyp.end && brands.length < 12; off += 4) {
    brands.push(buf.toString('latin1', off, off + 4));
  }
  const major = buf.toString('latin1', ftyp.headerEnd, ftyp.headerEnd + 4);
  const brandOk = MP4_ALLOWED_BRANDS.includes(major) || brands.some((b) => MP4_ALLOWED_BRANDS.includes(b));
  if (!brandOk) throw new VideoRejected(`mp4 brand ruxsat etilmagan (${major})`);

  const moov = findBox(top, 'moov');
  if (!moov) throw new VideoRejected('moov top box yo‘q (fragmented yoki buzilgan fayl)');

  const mvhd = findBox(readBoxes(buf, moov.headerEnd, moov.end), 'mvhd');
  if (!mvhd) throw new VideoRejected('moov ichida mvhd yo‘q');
  const version = buf.readUInt8(mvhd.headerEnd);
  let timescale = 0;
  let duration = 0;
  if (version === 1) {
    timescale = u32(buf, mvhd.headerEnd + 20);
    duration = u32(buf, mvhd.headerEnd + 24) * 0x1_0000_0000 + u32(buf, mvhd.headerEnd + 28);
  } else {
    timescale = u32(buf, mvhd.headerEnd + 12);
    duration = u32(buf, mvhd.headerEnd + 16);
  }
  if (!timescale) throw new VideoRejected('mvhd timescale 0');
  const durationSec = duration / timescale;

  // traktlar: video o'lchami + codec
  const traks = readBoxes(buf, moov.headerEnd, moov.end).filter((b) => b.type === 'trak');
  if (!traks.length) throw new VideoRejected('hech qanday trak yo‘q');
  let width = 0;
  let height = 0;
  let codec: string | undefined;
  let videoTracks = 0;
  for (const trak of traks.slice(0, 32)) {
    const inner = readBoxes(buf, trak.headerEnd, trak.end);
    const mdia = findBox(inner, 'mdia');
    if (!mdia) continue;
    const hdlr = findBox(readBoxes(buf, mdia.headerEnd, mdia.end), 'hdlr');
    if (!hdlr) continue;
    const handler = buf.toString('latin1', hdlr.headerEnd + 8, hdlr.headerEnd + 12);
    if (handler !== 'vide') continue;
    videoTracks++;
    const tkhd = findBox(inner, 'tkhd');
    if (tkhd && tkhd.end - tkhd.headerEnd >= 8) {
      // tkhd oxirgi 8 bayt: width/height (16.16 fixed point)
      width = u32(buf, tkhd.end - 8) >>> 16;
      height = u32(buf, tkhd.end - 4) >>> 16;
    }
    const minf = findBox(readBoxes(buf, mdia.headerEnd, mdia.end), 'minf');
    if (minf) {
      const stbl = findBox(readBoxes(buf, minf.headerEnd, minf.end), 'stbl');
      if (stbl) {
        const stsd = findBox(readBoxes(buf, stbl.headerEnd, stbl.end), 'stsd');
        if (stsd) {
          // stsd: version+flags(4) + entry_count(4), keyingi boxlar sample entries
          const entries = readBoxes(buf, stsd.headerEnd + 8, stsd.end);
          for (const e of entries) {
            if (MP4_ALLOWED_VIDEO_CODECS.includes(e.type)) {
              codec = e.type;
              break;
            }
          }
        }
      }
    }
  }
  if (!videoTracks) throw new VideoRejected('video trak yo‘q');
  if (!codec) throw new VideoRejected('video codec allowlist’da emas');
  return finalize({ container: 'mp4', durationSec, width, height, codec });
}

// ─── EBML (WebM) ─────────────────────────────────────────────────────────────
function readVint(buf: Buffer, off: number, keepMarker = false): { value: number; length: number } | null {
  if (off >= buf.length) return null;
  const first = buf[off];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && !(first & mask)) {
    length++;
    mask >>= 1;
  }
  if (length > 8 || off + length > buf.length) return null;
  // ID o'qishda (keepMarker) marker BAJI saqlanadi — EBML ID'si xom baytlar
  // (marker bit shu birinchi bayt ichida). Qiymat/sizes uchun marker olib tashlanadi.
  let value = keepMarker ? first : first & (mask - 1);
  for (let i = 1; i < length; i++) value = value * 256 + buf[off + i];
  return { value, length };
}

const EBML_IDS = {
  Header: 0x1a45dfa3,
  DocType: 0x4282,
  Segment: 0x18538067,
  Info: 0x1549a966,
  Duration: 0x4489,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
};
// Ichiga kiriladigan (container) elementlar; qolganlari — yaproq qiymatlar.
const EBML_CONTAINERS = new Set<number>([
  EBML_IDS.Header,
  EBML_IDS.Segment,
  EBML_IDS.Info,
  EBML_IDS.Tracks,
  EBML_IDS.TrackEntry,
  EBML_IDS.Video,
]);

function parseWebm(buf: Buffer): VideoInfo {
  // Reader: top-level → Header/Segment; ichki elementlarni chuqurlik 3 gacha.
  let offset = 0;
  let visits = 0;
  let docType = '';
  let durationSec = 0;
  let width = 0;
  let height = 0;

  const readFloat = (b: Buffer, off: number, size: number): number => {
    if (size === 4) return b.readFloatBE(off);
    if (size === 8) return b.readDoubleBE(off);
    return NaN;
  };

  function walk(start: number, end: number, depth: number): void {
    let off = start;
    while (off < end && visits++ < MAX_BOX_VISITS) {
      const id = readVint(buf, off, true);
      if (!id) break;
      const sizeOff = off + id.length;
      const size = readVint(buf, sizeOff);
      if (!size) break;
      const dataStart = sizeOff + size.length;
      // "unknown size" (all data bits 1) → element daraxti o'qilmaydigan — fail
      const unknown = size.value === Math.pow(2, 7 * size.length) - 2;
      if (unknown) throw new VideoRejected('webm unknown-size element (no parsing)');
      const dataEnd = dataStart + size.value;
      if (dataEnd > end) throw new VideoRejected('webm element chegaradan tashqarida');
      const idNum = id.value;
      if (idNum === EBML_IDS.DocType) {
        docType = buf.toString('ascii', dataStart, dataEnd);
      } else if (idNum === EBML_IDS.Duration) {
        durationSec = readFloat(buf, dataStart, size.value) / 1000;
      } else if (idNum === EBML_IDS.PixelWidth) {
        width = readUint(buf, dataStart, size.value) || width;
      } else if (idNum === EBML_IDS.PixelHeight) {
        height = readUint(buf, dataStart, size.value) || height;
      } else if (EBML_CONTAINERS.has(idNum) && depth < 5) {
        walk(dataStart, dataEnd, depth + 1);
      }
      off = dataEnd;
    }
  }

  walk(0, buf.length, 0);
  if (docType !== 'webm') throw new VideoRejected(`EBML DocType "webm" emas (${docType || 'topilmadi'})`);
  if (!durationSec) throw new VideoRejected('Duration yo‘q yoki 0');
  return finalize({ container: 'webm', durationSec, width, height });
}

function finalize(info: VideoInfo): VideoInfo {
  if (!Number.isFinite(info.durationSec) || info.durationSec < MIN_DURATION_SEC || info.durationSec > MAX_DURATION_SEC) {
    throw new VideoRejected(`davomiylik ruxsat etilmagan (${info.durationSec}s; ${MIN_DURATION_SEC}–${MAX_DURATION_SEC}s)`);
  }
  if (info.width < 0 || info.height < 0 || info.width > MAX_DIM || info.height > MAX_DIM) {
    throw new VideoRejected(`o'lcham ruxsat etilmagan (${info.width}x${info.height})`);
  }
  if (info.width && info.height && info.width * info.height > MAX_PIXELS) {
    throw new VideoRejected('piksel maydoni juda katta');
  }
  return info;
}

/**
 * Video buffer'ni tahlil qiladi; yaroqsiz bo'lsa status=400 xato otadi.
 * Chaqiruvchi (storeVideo) xatoni saqlashdan OLDIN oladi — hech narsa yozilmaydi.
 */
export function parseVideoSafe(buf: Buffer): VideoInfo {
  if (buf.length < 1024) throw new VideoRejected('fayl juda kichik');
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return parseMp4(buf);
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return parseWebm(buf);
  }
  throw new VideoRejected('imzo MP4 yoki WebM emas');
}
