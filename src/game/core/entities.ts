import type { Vec2 } from './math';

export type ShipKind = 'player' | 'chaser' | 'shooter';
export type EnemyKind = Exclude<ShipKind, 'player'>;
export type Faction = 'player' | 'enemy';
export type WeaponSlot = 'front' | 'left' | 'right' | 'volley';
export type BroadsideSide = 'left' | 'right';

export interface Ship {
  readonly id: number;
  readonly kind: ShipKind;
  readonly position: Vec2;
  heading: number;
  speed: number;
  health: number;
  readonly maxHealth: number;
  readonly radius: number;
  alive: boolean;
  readonly cooldowns: Record<WeaponSlot, number>;
}

export interface Projectile {
  id: number;
  faction: Faction;
  readonly position: Vec2;
  readonly velocity: Vec2;
  damage: number;
  radius: number;
  remainingDistance: number;
  remainingLifetime: number;
  active: boolean;
}

export interface PlayerIntent {
  thrust: boolean;
  turn: -1 | 0 | 1;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
  fireVolley: boolean;
}

export function createIdleIntent(): PlayerIntent {
  return {
    thrust: false,
    turn: 0,
    fireFront: false,
    fireLeft: false,
    fireRight: false,
    fireVolley: false,
  };
}

export function healthRatio(ship: Ship): number {
  return ship.maxHealth > 0 ? Math.max(0, ship.health) / ship.maxHealth : 0;
}
