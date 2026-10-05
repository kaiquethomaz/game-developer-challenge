import type { EnemyKind, Faction, ShipKind, WeaponSlot } from './entities';

export type EndReason = 'time' | 'death';
export type DestroyCause = 'projectile' | 'collision';

export type SimulationEvent =
  | {
      readonly type: 'shot';
      readonly shooter: ShipKind;
      readonly slot: WeaponSlot;
      readonly x: number;
      readonly y: number;
      readonly angle: number;
    }
  | {
      readonly type: 'hit';
      readonly target: ShipKind;
      readonly targetId: number;
      readonly faction: Faction;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'splash'; readonly x: number; readonly y: number }
  | {
      readonly type: 'destroyed';
      readonly kind: EnemyKind;
      readonly id: number;
      readonly cause: DestroyCause;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'spawned'; readonly kind: EnemyKind; readonly id: number }
  | { readonly type: 'scored'; readonly score: number }
  | { readonly type: 'playerDamaged'; readonly health: number }
  | { readonly type: 'islandBump'; readonly x: number; readonly y: number }
  | { readonly type: 'salvageDropped'; readonly id: number; readonly x: number; readonly y: number }
  | {
      readonly type: 'repaired';
      readonly amount: number;
      readonly health: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'ended'; readonly reason: EndReason };
