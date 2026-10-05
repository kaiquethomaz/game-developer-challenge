import type { BroadsideConfig, VolleyConfig, WeaponConfig } from '../config';
import type { BroadsideSide, Faction, Ship } from './entities';
import type { ProjectilePool } from './projectiles';

export interface ShotOrigin {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export function tickCooldowns(ship: Ship, dt: number): void {
  ship.cooldowns.front = Math.max(0, ship.cooldowns.front - dt);
  ship.cooldowns.left = Math.max(0, ship.cooldowns.left - dt);
  ship.cooldowns.right = Math.max(0, ship.cooldowns.right - dt);
  ship.cooldowns.volley = Math.max(0, ship.cooldowns.volley - dt);
}

export function fireFront(
  ship: Ship,
  weapon: WeaponConfig,
  faction: Faction,
  pool: ProjectilePool,
): ShotOrigin | null {
  if (ship.cooldowns.front > 0) return null;
  ship.cooldowns.front = weapon.cooldownSeconds;

  const muzzle = ship.radius + weapon.projectileRadius;
  const x = ship.position.x + Math.cos(ship.heading) * muzzle;
  const y = ship.position.y + Math.sin(ship.heading) * muzzle;
  pool.spawn(faction, { x, y }, ship.heading, weapon);
  return { x, y, angle: ship.heading };
}

export function fireVolley(
  ship: Ship,
  weapon: VolleyConfig,
  faction: Faction,
  pool: ProjectilePool,
): ShotOrigin | null {
  if (ship.cooldowns.volley > 0) return null;
  ship.cooldowns.volley = weapon.cooldownSeconds;

  const muzzle = ship.radius + weapon.projectileRadius;
  const x = ship.position.x + Math.cos(ship.heading) * muzzle;
  const y = ship.position.y + Math.sin(ship.heading) * muzzle;
  const centerIndex = (weapon.projectileCount - 1) / 2;
  for (let i = 0; i < weapon.projectileCount; i += 1) {
    pool.spawn(faction, { x, y }, ship.heading + (i - centerIndex) * weapon.spreadRadians, weapon);
  }
  return { x, y, angle: ship.heading };
}

export function fireBroadside(
  ship: Ship,
  weapon: BroadsideConfig,
  slot: BroadsideSide,
  faction: Faction,
  pool: ProjectilePool,
): ShotOrigin | null {
  if (ship.cooldowns[slot] > 0) return null;
  ship.cooldowns[slot] = weapon.cooldownSeconds;

  const angle = ship.heading + (slot === 'left' ? -Math.PI / 2 : Math.PI / 2);
  const sideX = Math.cos(angle);
  const sideY = Math.sin(angle);
  const alongX = Math.cos(ship.heading);
  const alongY = Math.sin(ship.heading);
  const sideOffset = ship.radius * weapon.sideOffsetRatio + weapon.projectileRadius;
  const centerIndex = (weapon.projectileCount - 1) / 2;

  for (let i = 0; i < weapon.projectileCount; i += 1) {
    const along = (i - centerIndex) * weapon.spacing;
    pool.spawn(
      faction,
      {
        x: ship.position.x + sideX * sideOffset + alongX * along,
        y: ship.position.y + sideY * sideOffset + alongY * along,
      },
      angle,
      weapon,
    );
  }

  return {
    x: ship.position.x + sideX * sideOffset,
    y: ship.position.y + sideY * sideOffset,
    angle,
  };
}
