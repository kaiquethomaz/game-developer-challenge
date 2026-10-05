import type { Texture } from 'pixi.js';
import type { GameTextures } from './textures';

export interface ScenePiece {
  readonly texture: (textures: GameTextures) => Texture;
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
  readonly scale?: number;
}

const PROP_SCALE = 1.4;

const tile =
  (id: number) =>
  (textures: GameTextures): Texture =>
    textures.tile(id);
const crew =
  (index: number) =>
  (textures: GameTextures): Texture =>
    textures.props.crew[index % textures.props.crew.length] ?? textures.props.barrel;

const WATCH_TOWER = tile(14);
const OUTPOST_TOWER = tile(13);
const RUINED_WALL = tile(90);
const PALM = tile(71);
const ROCK = tile(49);
const cannon = (textures: GameTextures) => textures.props.cannon;
const looseCannon = (textures: GameTextures) => textures.props.looseCannon;
const barrel = (textures: GameTextures) => textures.props.barrel;
const dinghy = (textures: GameTextures) => textures.props.dinghy;
const longboat = (textures: GameTextures) => textures.props.longboat;
const brokenLongboat = (textures: GameTextures) => textures.props.brokenLongboat;
const wreck = (textures: GameTextures) => textures.props.wreck;

const WATCH_POST: readonly ScenePiece[] = [
  { texture: WATCH_TOWER, x: 96, y: 96 },
  { texture: cannon, x: 168, y: 98, scale: PROP_SCALE },
  { texture: crew(0), x: 146, y: 136, rotation: 0.4, scale: PROP_SCALE },
  { texture: crew(3), x: 112, y: 158, rotation: -2.2, scale: PROP_SCALE },
  { texture: PALM, x: 158, y: 166, rotation: 0.8 },
];

const LANDING: readonly ScenePiece[] = [
  { texture: longboat, x: 34, y: 200, rotation: 0.7 },
  { texture: dinghy, x: 66, y: 226, rotation: 1.1 },
  { texture: crew(1), x: 98, y: 168, rotation: 2.6, scale: PROP_SCALE },
  { texture: crew(4), x: 124, y: 150, rotation: -0.6, scale: PROP_SCALE },
  { texture: barrel, x: 152, y: 118, scale: PROP_SCALE },
  { texture: barrel, x: 168, y: 132, scale: PROP_SCALE },
  { texture: PALM, x: 104, y: 92, rotation: 2.4 },
];

const SALVAGE_RUINS: readonly ScenePiece[] = [
  { texture: RUINED_WALL, x: 96, y: 96 },
  { texture: looseCannon, x: 150, y: 112, rotation: 0.5, scale: PROP_SCALE },
  { texture: crew(2), x: 140, y: 156, rotation: -1.4, scale: PROP_SCALE },
  { texture: ROCK, x: 104, y: 164, rotation: 1.6 },
  { texture: wreck, x: -14, y: 236, rotation: 2.3 },
];

const OUTPOST: readonly ScenePiece[] = [
  { texture: OUTPOST_TOWER, x: 160, y: 96 },
  { texture: looseCannon, x: 96, y: 98, rotation: -0.3, scale: PROP_SCALE },
  { texture: crew(5), x: 104, y: 150, rotation: 1.2, scale: PROP_SCALE },
  { texture: dinghy, x: 226, y: 52, rotation: -0.6 },
  { texture: PALM, x: 158, y: 164, rotation: 4.1 },
];

const CAMP: readonly ScenePiece[] = [
  { texture: cannon, x: 104, y: 104, rotation: Math.PI, scale: PROP_SCALE },
  { texture: barrel, x: 92, y: 158, scale: PROP_SCALE },
  { texture: barrel, x: 108, y: 170, scale: PROP_SCALE },
  { texture: crew(0), x: 148, y: 128, rotation: 3.3, scale: PROP_SCALE },
  { texture: crew(1), x: 136, y: 162, rotation: 2.1, scale: PROP_SCALE },
  { texture: crew(2), x: 168, y: 150, rotation: 4.4, scale: PROP_SCALE },
];

const CASTAWAY: readonly ScenePiece[] = [{ texture: brokenLongboat, x: 64, y: 62, rotation: 0.7 }];

export const LARGE_ISLAND_SCENES = [WATCH_POST, LANDING, SALVAGE_RUINS, OUTPOST, CAMP] as const;
export const SMALL_ISLAND_SCENE = CASTAWAY;
