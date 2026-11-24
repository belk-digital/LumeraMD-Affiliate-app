const sharp = require("sharp");
const fs = require("fs");
const NAVY = "#17324E";

async function tile(size) {
  const radius = Math.round(size * 0.22);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${NAVY}"/></svg>`,
  );
  // Just the hexagon mark: the wordmark below it is unreadable at tab size.
  const full = await sharp("public/lumera-logo-white.png").trim().toBuffer();
  const meta = await sharp(full).metadata();
  const trimmed = await sharp(full)
    .extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.8) })
    .trim()
    .toBuffer();
  const inner = Math.round(size * 0.74);
  const logo = await sharp(trimmed).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp(bg).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
}

(async () => {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(tile));
  // ICO container holding PNG images.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map((p, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0); e.writeUInt8(sizes[i], 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.length, 8); e.writeUInt32LE(offset, 12);
    offset += p.length;
    return e;
  });
  fs.writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
  fs.writeFileSync("src/app/icon.png", await tile(512));
  fs.writeFileSync("src/app/apple-icon.png", await tile(180));
  fs.writeFileSync("C:/Users/ASUS/AppData/Local/Temp/claude/c8897a05c247193e/1004663e-dcbf-4f8a-9b5b-ba7f6d1a2684/scratchpad/favicon-preview.png", await tile(256));
  console.log("written");
})();
