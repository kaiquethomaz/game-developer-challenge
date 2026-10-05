import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { TileRect } from '../config';
import type { Arena } from '../core/arena';
import { LARGE_ISLAND_SCENES, SMALL_ISLAND_SCENE, type ScenePiece } from './islandScenes';
import type { GameTextures } from './textures';

const WATER_TILE = 73;
const SHALLOW = { tl: 10, t: 11, tr: 12, l: 26, c: 27, r: 28, bl: 42, b: 43, br: 44 } as const;
const SAND = { tl: 1, t: 2, tr: 3, l: 17, c: 18, r: 19, bl: 33, b: 34, br: 35 } as const;
const GRASS = {
  tl: 6,
  t: [7, 8],
  tr: 9,
  l: [22, 38],
  c: [
    [23, 24],
    [39, 40],
  ],
  r: [25, 41],
  bl: 54,
  b: [55, 56],
  br: 57,
} as const;
const LARGE_ISLAND_SIZE = 4;

const SHIMMER_ALPHA = 0.22;
const SHIMMER_SPEED = { x: 9, y: 5 } as const;
const SHIMMER_SCALE = 1.6;

export class ArenaView extends Container {
  private readonly shimmer: TilingSprite | null = null;

  constructor(
    arena: Arena,
    islands: readonly TileRect[],
    textures: GameTextures,
    animate: boolean,
  ) {
    super({ label: 'arena' });
    const water = createWater(arena, textures);
    const land = createLand(arena, islands, textures);

    if (!animate) {
      this.addChild(water, land);
      this.cacheAsTexture(true);
      return;
    }

    this.shimmer = new TilingSprite({
      texture: textures.tile(WATER_TILE),
      width: arena.width,
      height: arena.height,
      alpha: SHIMMER_ALPHA,
      tileScale: { x: SHIMMER_SCALE, y: SHIMMER_SCALE },
    });
    water.cacheAsTexture(true);
    land.cacheAsTexture(true);
    this.addChild(water, this.shimmer, land);
  }

  update(dt: number): void {
    if (!this.shimmer) return;
    this.shimmer.tilePosition.x += SHIMMER_SPEED.x * dt;
    this.shimmer.tilePosition.y += SHIMMER_SPEED.y * dt;
  }
}

function createWater(arena: Arena, textures: GameTextures): Container {
  const water = new Container({ label: 'water' });
  const size = arena.tileSize;
  for (let row = 0; row < Math.round(arena.height / size); row += 1) {
    for (let col = 0; col < Math.round(arena.width / size); col += 1) {
      water.addChild(createTile(textures, WATER_TILE, col, row, size));
    }
  }
  return water;
}

function createLand(arena: Arena, islands: readonly TileRect[], textures: GameTextures): Container {
  const land = new Container({ label: 'land' });
  const size = arena.tileSize;
  const cols = Math.round(arena.width / size);
  const rows = Math.round(arena.height / size);

  for (const island of islands) {
    forEachTile(expand(island), (col, row, edge) => {
      if (col >= 0 && row >= 0 && col < cols && row < rows) {
        land.addChild(createTile(textures, SHALLOW[edge], col, row, size));
      }
    });
  }

  islands.forEach((island, index) => {
    const grassy = island.cols >= 3 && island.rows >= 3;
    forEachTile(island, (col, row, edge) => {
      land.addChild(
        createTile(
          textures,
          grassy ? pickGrassTile(edge, col - island.col - 1, row - island.row - 1) : SAND[edge],
          col,
          row,
          size,
        ),
      );
    });
    const large = island.cols >= LARGE_ISLAND_SIZE && island.rows >= LARGE_ISLAND_SIZE;
    const scene = large
      ? LARGE_ISLAND_SCENES[index % LARGE_ISLAND_SCENES.length]
      : SMALL_ISLAND_SCENE;
    for (const piece of scene ?? []) {
      land.addChild(createPiece(textures, piece, island.col * size, island.row * size));
    }
  });

  land.addChild(
    new Graphics()
      .rect(0, 0, arena.width, arena.height)
      .stroke({ width: 4, color: 0x0b3954, alpha: 0.6 }),
  );
  return land;
}

function createPiece(
  textures: GameTextures,
  piece: ScenePiece,
  originX: number,
  originY: number,
): Sprite {
  return new Sprite({
    texture: piece.texture(textures),
    anchor: 0.5,
    x: originX + piece.x,
    y: originY + piece.y,
    rotation: piece.rotation ?? 0,
    scale: piece.scale ?? 1,
  });
}

function createTile(
  textures: GameTextures,
  id: number,
  col: number,
  row: number,
  size: number,
): Sprite {
  const sprite = new Sprite(textures.tile(id));
  sprite.position.set(col * size, row * size);
  sprite.width = size;
  sprite.height = size;
  return sprite;
}

type Edge = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';

function forEachTile(rect: TileRect, visit: (col: number, row: number, edge: Edge) => void) {
  for (let row = rect.row; row < rect.row + rect.rows; row += 1) {
    for (let col = rect.col; col < rect.col + rect.cols; col += 1) {
      const vertical = row === rect.row ? 't' : row === rect.row + rect.rows - 1 ? 'b' : '';
      const horizontal = col === rect.col ? 'l' : col === rect.col + rect.cols - 1 ? 'r' : '';
      visit(col, row, (vertical + horizontal || 'c') as Edge);
    }
  }
}

function expand(rect: TileRect): TileRect {
  return { col: rect.col - 1, row: rect.row - 1, cols: rect.cols + 2, rows: rect.rows + 2 };
}

function pickGrassTile(edge: Edge, innerCol: number, innerRow: number): number {
  const colParity = Math.abs(innerCol) % 2;
  const rowParity = Math.abs(innerRow) % 2;
  switch (edge) {
    case 'tl':
    case 'tr':
    case 'bl':
    case 'br':
      return GRASS[edge];
    case 't':
    case 'b':
      return GRASS[edge][colParity] ?? GRASS[edge][0];
    case 'l':
    case 'r':
      return GRASS[edge][rowParity] ?? GRASS[edge][0];
    case 'c':
      return GRASS.c[rowParity]?.[colParity] ?? GRASS.c[0][0];
  }
}
