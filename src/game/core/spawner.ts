import type { SpawnConfig } from '../config';
import type { Arena } from './arena';
import type { EnemyKind, Ship } from './entities';
import { clamp, distanceSquared, lerp, type Vec2 } from './math';
import type { Random } from './random';

export class EnemySpawner {
  private timer: number;
  private readonly spawned: Record<EnemyKind, number> = { chaser: 0, shooter: 0 };

  constructor(
    private readonly config: SpawnConfig,
    private readonly random: Random,
  ) {
    this.timer = config.initialDelaySeconds;
  }

  get spawnedCount(): Readonly<Record<EnemyKind, number>> {
    return this.spawned;
  }

  update(dt: number, aliveCount: number, matchProgress: number): EnemyKind | null {
    this.timer -= dt;
    if (this.timer > 0) return null;

    this.timer += this.config.intervalSeconds;
    if (aliveCount >= this.maxAliveAt(matchProgress)) return null;
    return this.chooseKind(matchProgress);
  }

  maxAliveAt(matchProgress: number): number {
    const { start, end } = this.config.maxAlive;
    return Math.round(lerp(start, end, clamp(matchProgress, 0, 1)));
  }

  confirm(kind: EnemyKind): void {
    this.spawned[kind] += 1;
  }

  private chooseKind(matchProgress: number): EnemyKind {
    const total = this.spawned.chaser + this.spawned.shooter;
    if (total === 1) {
      return this.spawned.chaser === 1 ? 'shooter' : 'chaser';
    }
    const { start, end } = this.config.distribution;
    const progress = clamp(matchProgress, 0, 1);
    const chaser = lerp(start.chaser, end.chaser, progress);
    const shooter = lerp(start.shooter, end.shooter, progress);
    return this.random.next() * (chaser + shooter) < chaser ? 'chaser' : 'shooter';
  }
}

export function findSpawnPoint(
  arena: Arena,
  player: Ship,
  enemies: readonly Ship[],
  radius: number,
  config: SpawnConfig,
  random: Random,
): Vec2 | null {
  const { clearance, candidateAttempts, minDistanceFromPlayer } = config;
  const isFree = (point: Vec2): boolean =>
    !arena.isCircleBlocked(point, radius + clearance) &&
    enemies.every((enemy) => {
      const reach = enemy.radius + radius + clearance;
      return distanceSquared(enemy.position, point) >= reach * reach;
    });

  const minimumSquared = minDistanceFromPlayer * minDistanceFromPlayer;
  const margin = radius + clearance;

  for (let attempt = 0; attempt < candidateAttempts; attempt += 1) {
    const candidate = {
      x: random.range(margin, arena.width - margin),
      y: random.range(margin, arena.height - margin),
    };
    if (distanceSquared(candidate, player.position) >= minimumSquared && isFree(candidate)) {
      return candidate;
    }
  }

  let farthest: Vec2 | null = null;
  let farthestDistance = -1;
  const step = arena.tileSize / 2;
  for (let y = margin; y <= arena.height - margin; y += step) {
    for (let x = margin; x <= arena.width - margin; x += step) {
      const candidate = { x, y };
      const candidateDistance = distanceSquared(candidate, player.position);
      if (
        candidateDistance >= minimumSquared &&
        candidateDistance > farthestDistance &&
        isFree(candidate)
      ) {
        farthest = candidate;
        farthestDistance = candidateDistance;
      }
    }
  }
  return farthest;
}
