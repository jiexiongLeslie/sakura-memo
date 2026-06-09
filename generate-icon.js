// Generate sakura tray icon
// A 32x32 pink sakura circle with "S" letter

const fs = require("fs");

// Create a simple 32x32 PNG with a pink circle
// PNG format: signature + IHDR + IDAT + IEND
// Using raw pixel manipulation

function createPNG(width, height, pixels) {
  const zlib = require("zlib");

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // color type: RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // Raw image data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const idx = y * (1 + width * 4) + 1 + x * 4;
      const pi = (y * width + x) * 4;
      raw[idx] = pixels[pi];     // R
      raw[idx + 1] = pixels[pi + 1]; // G
      raw[idx + 2] = pixels[pi + 2]; // B
      raw[idx + 3] = pixels[pi + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = crc32(Buffer.concat([t, data]));
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc, 0);
    return Buffer.concat([len, t, data, c]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Sakura color: #F472B6
const sakuraR = 0xF4;
const sakuraG = 0x72;
const sakuraB = 0xB6;

const size = 32;
const cx = size / 2;
const cy = size / 2;
const outerR = 14;
const innerR = 11;

const pixels = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Round corners at edges
    const cornerDist = Math.max(0, Math.max(Math.abs(dx), Math.abs(dy)) - outerR);

    if (dist <= innerR - 1) {
      // Inner circle - solid sakura
      pixels[i] = sakuraR;
      pixels[i + 1] = sakuraG;
      pixels[i + 2] = sakuraB;
      pixels[i + 3] = 255;
    } else if (dist <= outerR) {
      // Anti-aliased edge
      const alpha = Math.round(255 * (1 - (dist - innerR) / (outerR - innerR)));
      pixels[i] = sakuraR;
      pixels[i + 1] = sakuraG;
      pixels[i + 2] = sakuraB;
      pixels[i + 3] = Math.max(0, Math.min(255, alpha));
    } else {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    }
  }
}

// Draw "S" letter in white
function setPixel(px, py, r, g, b, a) {
  if (px < 0 || px >= size || py < 0 || py >= size) return;
  const i = (Math.round(py) * size + Math.round(px)) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = a;
}

// Simple "S" at center
// Top horizontal
for (let x = 11; x <= 19; x++) setPixel(x, 12, 255, 255, 255, 255);
// Left vertical (top half)
for (let y = 12; y <= 15; y++) setPixel(11, y, 255, 255, 255, 255);
// Middle horizontal
for (let x = 11; x <= 19; x++) setPixel(x, 16, 255, 255, 255, 255);
// Right vertical (bottom half)
for (let y = 16; y <= 19; y++) setPixel(19, y, 255, 255, 255, 255);
// Bottom horizontal
for (let x = 11; x <= 19; x++) setPixel(x, 19, 255, 255, 255, 255);

const png = createPNG(size, size, pixels);
fs.writeFileSync(__dirname + "/assets/icon.png", png);
console.log("Icon created: assets/icon.png");
