import type { EnemySteeringConfig, ShooterConfig } from '../config';
import type { Arena } from './arena';
import type { Ship } from './entities';
import { angleTo, clamp, distance, wrapAngle, type Vec2 } from './math';
import { moveShip } from './movement';
import type { FlowField } from './navigation';

export interface SteeringContext {
  readonly arena: Arena;
  readonly flowField: FlowField;
  readonly player: Ship;
}

const waypoint: Vec2 = { x: 0, y: 0 };

export function chooseSteeringTarget(ship: Ship, context: SteeringContext): Vec2 {
  const { arena, flowField, player } = context;
  if (arena.hasLineOfSight(ship.position, player.position, ship.radius)) {
    return player.position;
  }
  return flowField.nextWaypoint(ship.position, waypoint) ? waypoint : player.position;
}

export function steerTowards(
  ship: Ship,
  config: EnemySteeringConfig,
  arena: Arena,
  target: Vec2,
  throttle: number,
  dt: number,
): number {
  const error = wrapAngle(angleTo(ship.position, target) - ship.heading);
  const turn = clamp(error / Math.max(config.turnSpeed * dt, Number.EPSILON), -1, 1);
  const sharpTurnFactor = Math.abs(error) > config.sharpTurnRadians ? config.sharpTurnThrottle : 1;
  moveShip(ship, config, arena, throttle * sharpTurnFactor, turn, dt);
  return error;
}

export function updateChaser(
  ship: Ship,
  config: EnemySteeringConfig,
  context: SteeringContext,
  dt: number,
): void {
  steerTowards(ship, config, context.arena, chooseSteeringTarget(ship, context), 1, dt);
}

export function updateShooter(
  ship: Ship,
  config: ShooterConfig,
  context: SteeringContext,
  dt: number,
): boolean {
  const { arena, player } = context;
  const range = distance(ship.position, player.position);
  const hasLineOfSight = arena.hasLineOfSight(
    ship.position,
    player.position,
    config.lineOfSightRadius,
  );

  if (!hasLineOfSight || range > config.preferredRange) {
    const slowdown = hasLineOfSight
      ? clamp(
          (range - config.preferredRange) / config.preferredRange + config.minApproachThrottle,
          config.minApproachThrottle,
          1,
        )
      : 1;
    steerTowards(ship, config, arena, chooseSteeringTarget(ship, context), slowdown, dt);
  } else {
    steerTowards(ship, config, arena, player.position, 0, dt);
  }

  const aimError = Math.abs(wrapAngle(angleTo(ship.position, player.position) - ship.heading));
  return hasLineOfSight && range <= config.attackRange && aimError <= config.aimToleranceRadians;
}

export function separateShips(a: Ship, b: Ship, arena: Arena): boolean {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const minimum = a.radius + b.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minimum * minimum) return false;

  const length = Math.sqrt(distanceSquared) || 1;
  const push = (minimum - length) / 2;
  const nx = distanceSquared > 0 ? dx / length : 1;
  const ny = distanceSquared > 0 ? dy / length : 0;
  a.position.x -= nx * push;
  a.position.y -= ny * push;
  b.position.x += nx * push;
  b.position.y += ny * push;
  arena.resolveCircle(a.position, a.radius);
  arena.resolveCircle(b.position, b.radius);
  return true;
}
