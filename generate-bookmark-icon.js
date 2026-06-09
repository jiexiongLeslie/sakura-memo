// Generate a sakura star/bookmark icon
// 32x32 PNG with a sakura pink star on transparent background

const fs = require("fs");

function createPNG(width, height, pixels) {
  const zlib = require("zlib");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * (1 + width * 4) + 1 + x * 4;
      const pi = (y * width + x) * 4;
      raw[idx] = pixels[pi];
      raw[idx + 1] = pixels[pi + 1];
      raw[idx + 2] = pixels[pi + 2];
      raw[idx + 3] = pixels[pi + 3];
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

// Sakura pink palette
const pR = 0xF4, pG = 0x72, pB = 0xB6;       // #F472B6 base
const hR = 0xFB, hG = 0x9E, hB = 0xCD;       // highlight / lighter
const dR = 0xDB, dG = 0x4C, dB = 0x8A;       // shadow / darker

const W = 32, H = 32;
const cx = W / 2, cy = H / 2;

// 5-pointed star geometry
function starPoints(cx, cy, outerR, innerR, points) {
  const result = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / 2 * -1) + (i * Math.PI / points);
    const r = i % 2 === 0 ? outerR : innerR;
    result.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return result;
}

// Edge-crossing check for anti-aliasing
function edgeFunc(x, y, p1, p2) {
  return (p2.x - p1.x) * (y - p1.y) - (p2.y - p1.y) * (x - p1.x);
}

// Check if point is inside star polygon
function isInsideStar(px, py, star) {
  let inside = true;
  for (let i = 0; i < star.length; i++) {
    const p1 = star[i];
    const p2 = star[(i + 1) % star.length];
    if (edgeFunc(px, py, p1, p2) > 0) {
      inside = false;
      break;
    }
  }
  // Star is not convex, use crossing-number for concave
  if (!inside) {
    // Try winding number / ray casting
    let crossings = 0;
    for (let i = 0; i < star.length; i++) {
      const p1 = star[i];
      const p2 = star[(i + 1) % star.length];
      if ((p1.y <= py && p2.y > py) || (p2.y <= py && p1.y > py)) {
        const t = (py - p1.y) / (p2.y - p1.y);
        const xInt = p1.x + t * (p2.x - p1.x);
        if (px < xInt) crossings++;
      }
    }
    return crossings % 2 === 1;
  }
  return inside;
}

// Distance to nearest star edge
function distToStarEdge(px, py, star) {
  let minDist = Infinity;
  for (let i = 0; i < star.length; i++) {
    const p1 = star[i];
    const p2 = star[(i + 1) % star.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) continue;
    const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / (len * len)));
    const cx = p1.x + t * dx;
    const cy = p1.y + t * dy;
    const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    minDist = Math.min(minDist, dist);
  }
  return minDist;
}

// Star with outer radius 13, inner radius 5.5
const outerR = 13;
const innerR = 5.5;
const star = starPoints(cx + 0.5, cy + 1, outerR, innerR, 5);

const pixels = Buffer.alloc(W * H * 4);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const inside = isInsideStar(x, y, star);

    if (inside) {
      // Simple gradient from top-left to bottom-right
      const grad = 0.4 + 0.6 * (1 - (x + y) / (W + H));
      pixels[i] = Math.round(pR * grad + dR * (1 - grad) * 0.3);
      pixels[i + 1] = Math.round(pG * grad);
      pixels[i + 2] = Math.round(pB * grad + dB * (1 - grad) * 0.2);
      pixels[i + 3] = 255;
    } else {
      // Anti-alias edges
      const dist = distToStarEdge(x, y, star);
      if (dist < 1.2) {
        const alpha = Math.round(255 * Math.max(0, 1 - dist / 1.2) * 0.85);
        pixels[i] = pR;
        pixels[i + 1] = pG;
        pixels[i + 2] = pB;
        pixels[i + 3] = alpha;
      } else {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;
      }
    }
  }
}

// Add a subtle highlight arc at top-left
for (let y = 3; y < 14; y++) {
  for (let x = 7; x < 16; x++) {
    const i = (y * W + x) * 4;
    if (pixels[i + 3] === 255) {
      const dx = x - (cx - 3);
      const dy = y - (cy - 6);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 5 && pixels[i + 3] === 255) {
        pixels[i] = Math.min(255, pixels[i] + 20);
        pixels[i + 1] = Math.min(255, pixels[i + 1] + 15);
        pixels[i + 2] = Math.min(255, pixels[i + 2] + 20);
      }
    }
  }
}

const png = createPNG(W, H, pixels);
fs.writeFileSync(__dirname + "/assets/bookmark.png", png);
console.log("Bookmark icon created: assets/bookmark.png");
