import { Assets, Rectangle, type Spritesheet, type Texture } from 'pixi.js';
import type { ShipKind } from '../core/entities';

export interface HealthBarTextures {
  readonly frame: Texture;
  readonly fill: Texture;
  readonly fillRect: Rectangle;
}

export interface PropTextures {
  readonly crew: readonly Texture[];
  readonly cannon: Texture;
  readonly looseCannon: Texture;
  readonly barrel: Texture;
  readonly dinghy: Texture;
  readonly longboat: Texture;
  readonly brokenLongboat: Texture;
  readonly wreck: Texture;
}

export interface GameTextures {
  readonly ships: Readonly<Record<ShipKind, readonly Texture[]>>;
  readonly cannonBall: Texture;
  readonly explosion: readonly Texture[];
  readonly fire: readonly Texture[];
  readonly debris: readonly Texture[];
  readonly tile: (id: number) => Texture;
  readonly props: PropTextures;
  readonly playerHealth: HealthBarTextures;
  readonly enemyHealth: HealthBarTextures;
}

const SHIP_COLOR_COLUMN: Readonly<Record<ShipKind, number>> = {
  player: 5,
  shooter: 2,
  chaser: 3,
};
const SHIP_COLORS = 6;
const DAMAGE_STAGES = 4;
const HEALTH_FILL_RECT = new Rectangle(24, 12, 112, 15);

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}

export function getAtlasUrls(pixelRatio: number): readonly string[] {
  return [
    assetUrl('atlas/ships.json'),
    assetUrl(pixelRatio > 1 ? 'atlas/tiles@2x.json' : 'atlas/tiles.json'),
    assetUrl('spritesheet/ui_sheet.json'),
  ];
}

export async function loadGameTextures(
  onProgress: (progress: number) => void,
  pixelRatio = window.devicePixelRatio,
): Promise<GameTextures> {
  const [shipsUrl, tilesUrl, uiUrl] = getAtlasUrls(pixelRatio);
  if (!shipsUrl || !tilesUrl || !uiUrl) throw new Error('Atlas list is incomplete');

  const sheets = await Assets.load<Spritesheet>([shipsUrl, tilesUrl, uiUrl], {
    onProgress,
    strategy: 'retry',
    retryCount: 2,
    retryDelay: 300,
  });

  const ships = requireSheet(sheets, shipsUrl);
  const tiles = requireSheet(sheets, tilesUrl);
  const ui = requireSheet(sheets, uiUrl);

  const shipStages = (kind: ShipKind): Texture[] =>
    Array.from({ length: DAMAGE_STAGES }, (_, stage) =>
      requireTexture(ships, `ship_${SHIP_COLOR_COLUMN[kind] + stage * SHIP_COLORS}`),
    );

  return {
    ships: {
      player: shipStages('player'),
      chaser: shipStages('chaser'),
      shooter: shipStages('shooter'),
    },
    cannonBall: requireTexture(ships, 'cannon_ball'),
    explosion: ['explosion_3', 'explosion_2', 'explosion_1'].map((name) =>
      requireTexture(ships, name),
    ),
    fire: ['fire_1', 'fire_2'].map((name) => requireTexture(ships, name)),
    debris: ['wood_1', 'wood_2', 'wood_3', 'wood_4'].map((name) => requireTexture(ships, name)),
    tile: (id) => requireTexture(tiles, `tile_${id}`),
    props: {
      crew: ['crew_1', 'crew_2', 'crew_3', 'crew_4', 'crew_5', 'crew_6'].map((name) =>
        requireTexture(ships, name),
      ),
      cannon: requireTexture(ships, 'cannon_mobile'),
      looseCannon: requireTexture(ships, 'cannon_loose'),
      barrel: requireTexture(ships, 'nest'),
      dinghy: requireTexture(ships, 'dinghy_small_1'),
      longboat: requireTexture(ships, 'dinghy_large_1'),
      brokenLongboat: requireTexture(ships, 'dinghy_large_3'),
      wreck: requireTexture(ships, 'hull_small_4'),
    },
    playerHealth: {
      frame: requireTexture(ui, 'enemy_health_frame'),
      fill: requireTexture(ui, 'enemy_health_fill_green'),
      fillRect: HEALTH_FILL_RECT,
    },
    enemyHealth: {
      frame: requireTexture(ui, 'enemy_health_frame'),
      fill: requireTexture(ui, 'enemy_health_fill_red'),
      fillRect: HEALTH_FILL_RECT,
    },
  };
}

function requireSheet(sheets: Record<string, Spritesheet>, url: string): Spritesheet {
  const sheet = sheets[url];
  if (!sheet) throw new Error(`Atlas failed to load: ${url}`);
  return sheet;
}

function requireTexture(sheet: Spritesheet, name: string): Texture {
  const texture = sheet.textures[name];
  if (!texture) throw new Error(`Missing texture "${name}"`);
  return texture;
}
