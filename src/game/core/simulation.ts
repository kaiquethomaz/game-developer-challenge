import type { GameConfig } from '../config';
import { Arena } from './arena';
import { separateShips, updateChaser, updateShooter, type SteeringContext } from './enemies';
import type { EnemyKind, Faction, PlayerIntent, Ship, ShipKind, WeaponSlot } from './entities';
import type { DestroyCause, EndReason, SimulationEvent } from './events';
import { distanceSquared, type Vec2 } from './math';
import { moveShip } from './movement';
import { FlowField } from './navigation';
import { ProjectilePool } from './projectiles';
import { fireBroadside, fireFront, tickCooldowns, type ShotOrigin } from './weapons';

export type MatchStatus = 'running' | 'ended';

export interface SimulationState {
  elapsedSeconds: number;
  status: MatchStatus;
  endReason: EndReason | null;
  score: number;
  readonly player: Ship;
  readonly enemies: Ship[];
}

export class Simulation {
  readonly arena: Arena;
  readonly state: SimulationState;
  readonly projectiles = new ProjectilePool();
  private events: SimulationEvent[] = [];
  private nextId = 1;
  private wasPlayerBlocked = false;
  private readonly flowField: FlowField;
  private navigationTimer = 0;

  constructor(
    readonly config: GameConfig,
    readonly seed: number,
  ) {
    this.arena = new Arena(config.arena);
    this.flowField = new FlowField(
      this.arena,
      Math.max(config.chaser.radius, config.shooter.radius) + 2,
    );
    const start = config.arena.playerStart;
    this.state = {
      elapsedSeconds: 0,
      status: 'running',
      endReason: null,
      score: 0,
      player: this.createShip('player', start, start.heading),
      enemies: [],
    };
  }

  get remainingSeconds(): number {
    return Math.max(0, this.config.matchDurationSeconds - this.state.elapsedSeconds);
  }

  step(dt: number, intent: PlayerIntent): void {
    if (this.state.status !== 'running') return;

    this.state.elapsedSeconds += dt;
    this.updatePlayer(dt, intent);
    this.updateNavigation(dt);
    this.updateEnemies(dt);
    this.resolveShipContacts();
    this.updateProjectiles(dt);
    this.removeDestroyedEnemies();
  }

  spawnEnemy(kind: EnemyKind, position: Vec2, heading: number): Ship {
    const enemy = this.createShip(kind, position, heading);
    this.state.enemies.push(enemy);
    this.emit({ type: 'spawned', kind, id: enemy.id });
    return enemy;
  }

  drainEvents(): SimulationEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private emit(event: SimulationEvent): void {
    this.events.push(event);
  }

  private createShip(kind: ShipKind, position: Vec2, heading: number): Ship {
    const stats = this.config[kind];
    const id = this.nextId;
    this.nextId += 1;
    return {
      id,
      kind,
      position: { x: position.x, y: position.y },
      heading,
      speed: 0,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      radius: stats.radius,
      alive: true,
      cooldowns: { front: 0, left: 0, right: 0 },
    };
  }

  private updatePlayer(dt: number, intent: PlayerIntent): void {
    const { player } = this.state;
    const { player: config } = this.config;

    tickCooldowns(player, dt);
    const blocked = moveShip(player, config, this.arena, intent.thrust ? 1 : 0, intent.turn, dt);
    if (
      blocked &&
      !this.wasPlayerBlocked &&
      this.arena.hitsIsland(player.position, player.radius + 1)
    ) {
      this.emit({ type: 'islandBump', x: player.position.x, y: player.position.y });
    }
    this.wasPlayerBlocked = blocked;

    if (intent.fireFront) {
      this.emitShot(
        player,
        'front',
        fireFront(player, config.frontCannon, 'player', this.projectiles),
      );
    }
    if (intent.fireLeft) {
      this.emitShot(
        player,
        'left',
        fireBroadside(player, config.broadside, 'left', 'player', this.projectiles),
      );
    }
    if (intent.fireRight) {
      this.emitShot(
        player,
        'right',
        fireBroadside(player, config.broadside, 'right', 'player', this.projectiles),
      );
    }
  }

  private updateNavigation(dt: number): void {
    this.navigationTimer -= dt;
    if (this.navigationTimer > 0) return;
    this.navigationTimer = this.config.navigation.refreshIntervalSeconds;
    this.flowField.build(this.state.player.position);
  }

  private updateEnemies(dt: number): void {
    const context: SteeringContext = {
      arena: this.arena,
      flowField: this.flowField,
      player: this.state.player,
    };

    for (const enemy of this.state.enemies) {
      if (!enemy.alive) continue;
      tickCooldowns(enemy, dt);

      if (enemy.kind === 'chaser') {
        updateChaser(enemy, this.config.chaser, context, dt);
        continue;
      }

      const wantsToFire = updateShooter(enemy, this.config.shooter, context, dt);
      if (wantsToFire) {
        this.emitShot(
          enemy,
          'front',
          fireFront(enemy, this.config.shooter.cannon, 'enemy', this.projectiles),
        );
      }
    }
  }

  private resolveShipContacts(): void {
    const { player, enemies } = this.state;

    for (const enemy of enemies) {
      if (!enemy.alive || !player.alive) continue;
      const reach = enemy.radius + player.radius;
      if (
        enemy.kind === 'chaser' &&
        distanceSquared(enemy.position, player.position) <= reach * reach
      ) {
        this.emit({
          type: 'hit',
          target: 'player',
          targetId: player.id,
          faction: 'enemy',
          x: enemy.position.x,
          y: enemy.position.y,
        });
        this.destroyEnemy(enemy, 'collision');
        this.applyDamage(player, this.config.chaser.contactDamage, 'collision');
      }
    }

    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      if (!a?.alive) continue;
      if (player.alive) separateShips(player, a, this.arena);
      for (let j = i + 1; j < enemies.length; j += 1) {
        const b = enemies[j];
        if (b?.alive) separateShips(a, b, this.arena);
      }
    }
  }

  private emitShot(ship: Ship, slot: WeaponSlot, origin: ShotOrigin | null): void {
    if (!origin) return;
    this.emit({ type: 'shot', shooter: ship.kind, slot, ...origin });
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles.active) {
      if (!projectile.active) continue;

      const dx = projectile.velocity.x * dt;
      const dy = projectile.velocity.y * dt;
      projectile.position.x += dx;
      projectile.position.y += dy;
      projectile.remainingDistance -= Math.hypot(dx, dy);
      projectile.remainingLifetime -= dt;

      if (this.arena.hitsIsland(projectile.position, projectile.radius)) {
        projectile.active = false;
        this.emit({ type: 'splash', x: projectile.position.x, y: projectile.position.y });
        continue;
      }
      if (this.arena.isOutside(projectile.position, projectile.radius)) {
        projectile.active = false;
        continue;
      }

      const target = this.findProjectileTarget(
        projectile.faction,
        projectile.position,
        projectile.radius,
      );
      if (target) {
        projectile.active = false;
        this.emit({
          type: 'hit',
          target: target.kind,
          targetId: target.id,
          faction: projectile.faction,
          x: projectile.position.x,
          y: projectile.position.y,
        });
        this.applyDamage(target, projectile.damage, 'projectile');
        continue;
      }

      if (projectile.remainingDistance <= 0 || projectile.remainingLifetime <= 0) {
        projectile.active = false;
        this.emit({ type: 'splash', x: projectile.position.x, y: projectile.position.y });
      }
    }
    this.projectiles.releaseInactive();
  }

  private findProjectileTarget(faction: Faction, position: Vec2, radius: number): Ship | null {
    if (faction === 'enemy') {
      const { player } = this.state;
      return player.alive && overlaps(player, position, radius) ? player : null;
    }
    for (const enemy of this.state.enemies) {
      if (enemy.alive && overlaps(enemy, position, radius)) return enemy;
    }
    return null;
  }

  private applyDamage(ship: Ship, amount: number, cause: DestroyCause): void {
    if (!ship.alive || this.state.status !== 'running') return;

    ship.health = Math.max(0, ship.health - amount);

    if (ship.kind === 'player') {
      this.emit({ type: 'playerDamaged', health: ship.health });
      if (ship.health <= 0) {
        ship.alive = false;
        this.end('death');
      }
      return;
    }

    if (ship.health <= 0) this.destroyEnemy(ship, cause);
  }

  private destroyEnemy(enemy: Ship, cause: DestroyCause): void {
    if (!enemy.alive || enemy.kind === 'player') return;
    enemy.alive = false;
    this.emit({
      type: 'destroyed',
      kind: enemy.kind,
      id: enemy.id,
      cause,
      x: enemy.position.x,
      y: enemy.position.y,
    });
    if (cause === 'projectile') {
      this.state.score += 1;
      this.emit({ type: 'scored', score: this.state.score });
    }
  }

  private removeDestroyedEnemies(): void {
    const { enemies } = this.state;
    let writeIndex = 0;
    for (const enemy of enemies) {
      if (enemy.alive) {
        enemies[writeIndex] = enemy;
        writeIndex += 1;
      }
    }
    enemies.length = writeIndex;
  }

  private end(reason: EndReason): void {
    if (this.state.status === 'ended') return;
    this.state.status = 'ended';
    this.state.endReason = reason;
    this.emit({ type: 'ended', reason });
  }
}

function overlaps(ship: Ship, position: Vec2, radius: number): boolean {
  const reach = ship.radius + radius;
  return distanceSquared(ship.position, position) <= reach * reach;
}
