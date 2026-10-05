import type { WeaponConfig } from '../config';
import type { Faction, Projectile } from './entities';
import type { Vec2 } from './math';

export class ProjectilePool {
  readonly active: Projectile[] = [];
  private readonly free: Projectile[] = [];
  private nextId = 1;

  spawn(faction: Faction, origin: Vec2, angle: number, weapon: WeaponConfig): Projectile {
    const projectile = this.free.pop() ?? createProjectile();
    projectile.id = this.nextId;
    this.nextId += 1;
    projectile.faction = faction;
    projectile.position.x = origin.x;
    projectile.position.y = origin.y;
    projectile.velocity.x = Math.cos(angle) * weapon.projectileSpeed;
    projectile.velocity.y = Math.sin(angle) * weapon.projectileSpeed;
    projectile.damage = weapon.damage;
    projectile.radius = weapon.projectileRadius;
    projectile.remainingDistance = weapon.projectileRange;
    projectile.remainingLifetime = weapon.projectileLifetimeSeconds;
    projectile.active = true;
    this.active.push(projectile);
    return projectile;
  }

  releaseInactive(): void {
    let writeIndex = 0;
    for (const projectile of this.active) {
      if (projectile.active) {
        this.active[writeIndex] = projectile;
        writeIndex += 1;
      } else {
        this.free.push(projectile);
      }
    }
    this.active.length = writeIndex;
  }

  clear(): void {
    for (const projectile of this.active) {
      projectile.active = false;
      this.free.push(projectile);
    }
    this.active.length = 0;
  }
}

function createProjectile(): Projectile {
  return {
    id: 0,
    faction: 'player',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    damage: 0,
    radius: 0,
    remainingDistance: 0,
    remainingLifetime: 0,
    active: false,
  };
}
