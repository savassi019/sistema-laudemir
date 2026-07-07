const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function u32BE(n) {
  return Buffer.from([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const ci = Buffer.concat([t, d]);
  return Buffer.concat([u32BE(d.length), t, d, u32BE(crc32(ci))]);
}

function createPNG(w, h, getColor) {
  const lines = [];
  for (let y = 0; y < h; y++) {
    const row = [0];
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getColor(x, y);
      row.push(r, g, b, a);
    }
    lines.push(Buffer.from(row));
  }
  const ihdr = Buffer.concat([u32BE(w), u32BE(h), Buffer.from([8, 6, 0, 0, 0])]);
  const raw = Buffer.concat(lines);
  const comp = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", comp),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, s, r) {
  const cx = Math.max(r, Math.min(s - 1 - r, x));
  const cy = Math.max(r, Math.min(s - 1 - r, y));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

function makeIcon(size) {
  const r = Math.round(size * 0.1875);
  const BG = [7, 17, 31, 255];
  const GOLD = [209, 160, 79, 255];
  const TR = [0, 0, 0, 0];
  const layers = [
    { oy: -0.28, hw: 0.30 },
    { oy:  0.00, hw: 0.42 },
    { oy:  0.28, hw: 0.54 },
  ];
  const barH = 0.09;
  return function (x, y) {
    if (!inRoundedRect(x, y, size, r)) return TR;
    const cx = size / 2, cy = size / 2;
    const nx = (x - cx) / (size / 2);
    const ny = (y - cy) / (size / 2);
    for (const { oy, hw } of layers) {
      if (Math.abs(nx) <= hw && Math.abs(ny - oy) <= barH) return GOLD;
    }
    return BG;
  };
}

const outDir = path.join(__dirname, "..", "public");
[192, 512].forEach(function (s) {
  const png = createPNG(s, s, makeIcon(s));
  const p = path.join(outDir, "icon-" + s + ".png");
  fs.writeFileSync(p, png);
  console.log("OK " + p + " (" + png.length + " bytes)");
});
