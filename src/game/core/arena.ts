import type { ArenaConfig } from '../config';
import { clamp, type Vec2 } from './math';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class Arena {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly islands: readonly Rect[];

  constructor(config: ArenaConfig) {
    this.tileSize = config.tileSize;
    this.width = config.cols * config.tileSize;
    this.height = config.rows * config.tileSize;
    this.islands = config.islands.map((tile) => ({
      x: tile.col * config.tileSize,
      y: tile.row * config.tileSize,
      width: tile.cols * config.tileSize,
      height: tile.rows * config.tileSize,
    }));
  }

  isOutside(point: Vec2, margin = 0): boolean {
    return (
      point.x < -margin ||
      point.y < -margin ||
      point.x > this.width + margin ||
      point.y > this.height + margin
    );
  }

  isCircleBlocked(center: Vec2, radius: number): boolean {
    if (
      center.x - radius < 0 ||
      center.y - radius < 0 ||
      center.x + radius > this.width ||
      center.y + radius > this.height
    ) {
      return true;
    }
    return this.islands.some((island) => circleOverlapsRect(center, radius, island));
  }

  hitsIsland(center: Vec2, radius: number): boolean {
    return this.islands.some((island) => circleOverlapsRect(center, radius, island));
  }

  hasLineOfSight(from: Vec2, to: Vec2, radius: number): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.ceil(length / (this.tileSize / 4)));
    const probe = { x: 0, y: 0 };
    for (let i = 1; i < samples; i += 1) {
      const t = i / samples;
      probe.x = from.x + dx * t;
      probe.y = from.y + dy * t;
      if (this.hitsIsland(probe, radius)) return false;
    }
    return true;
  }

  resolveCircle(position: Vec2, radius: number): boolean {
    let collided = false;
    for (const island of this.islands) {
      if (pushCircleOutOfRect(position, radius, island)) collided = true;
    }

    const clampedX = clamp(position.x, radius, this.width - radius);
    const clampedY = clamp(position.y, radius, this.height - radius);
    if (clampedX !== position.x || clampedY !== position.y) {
      position.x = clampedX;
      position.y = clampedY;
      collided = true;
    }
    return collided;
  }
}

export function circleOverlapsRect(center: Vec2, radius: number, rect: Rect): boolean {
  const nearestX = clamp(center.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(center.y, rect.y, rect.y + rect.height);
  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function pushCircleOutOfRect(position: Vec2, radius: number, rect: Rect): boolean {
  const nearestX = clamp(position.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(position.y, rect.y, rect.y + rect.height);
  const dx = position.x - nearestX;
  const dy = position.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= radius * radius) return false;

  if (distanceSquared > 0) {
    const distance = Math.sqrt(distanceSquared);
    const overlap = radius - distance;
    position.x += (dx / distance) * overlap;
    position.y += (dy / distance) * overlap;
    return true;
  }

  const toLeft = position.x - rect.x;
  const toRight = rect.x + rect.width - position.x;
  const toTop = position.y - rect.y;
  const toBottom = rect.y + rect.height - position.y;
  const minimum = Math.min(toLeft, toRight, toTop, toBottom);

  if (minimum === toLeft) position.x = rect.x - radius;
  else if (minimum === toRight) position.x = rect.x + rect.width + radius;
  else if (minimum === toTop) position.y = rect.y - radius;
  else position.y = rect.y + rect.height + radius;
  return true;
}
