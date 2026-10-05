import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'public', 'assets');
const output = join(assets, 'atlas');

const TILE_SIZE = 64;
const TILE_COLUMNS = 16;
const TILE_ROWS = 6;

function frame(x, y, w, h) {
  return {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
  };
}

function meta(image, width, height, scale) {
  return { image, format: 'RGBA8888', size: { w: width, h: height }, scale: String(scale) };
}

async function buildShipsAtlas() {
  const xml = await readFile(join(assets, 'spritesheet', 'ships_miscellaneous_sheet.xml'), 'utf8');
  const frames = {};
  const pattern =
    /<SubTexture name="([^"]+)\.png" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g;
  for (const [, name, x, y, w, h] of xml.matchAll(pattern)) {
    frames[name] = frame(Number(x), Number(y), Number(w), Number(h));
  }
  return {
    frames,
    meta: meta('../spritesheet/ships_miscellaneous_sheet.png', 1024, 512, 1),
  };
}

function buildTilesAtlas(scale) {
  const size = TILE_SIZE * scale;
  const frames = {};
  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let col = 0; col < TILE_COLUMNS; col += 1) {
      frames[`tile_${row * TILE_COLUMNS + col + 1}`] = frame(col * size, row * size, size, size);
    }
  }
  const image = scale === 1 ? 'tiles_sheet.png' : 'tiles_sheet_retina.png';
  return {
    frames,
    meta: meta(`../tilesheet/${image}`, TILE_COLUMNS * size, TILE_ROWS * size, scale),
  };
}

await mkdir(output, { recursive: true });
const atlases = {
  'ships.json': await buildShipsAtlas(),
  'tiles.json': buildTilesAtlas(1),
  'tiles@2x.json': buildTilesAtlas(2),
};
for (const [file, atlas] of Object.entries(atlases)) {
  await writeFile(join(output, file), `${JSON.stringify(atlas, null, 2)}\n`);
  console.log(`atlas: ${file} (${Object.keys(atlas.frames).length} frames)`);
}
