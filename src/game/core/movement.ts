import type { ShipMovementConfig } from '../config';
import type { Arena } from './arena';
import type { Ship } from './entities';
import { approach, wrapAngle } from './math';

export function moveShip(
  ship: Ship,
  config: ShipMovementConfig,
  arena: Arena,
  throttle: number,
  turn: number,
  dt: number,
): boolean {
  ship.heading = wrapAngle(ship.heading + turn * config.turnSpeed * dt);

  const targetSpeed = config.maxSpeed * throttle;
  const rate = targetSpeed > ship.speed ? config.acceleration : config.deceleration;
  ship.speed = approach(ship.speed, targetSpeed, rate * dt);

  ship.position.x += Math.cos(ship.heading) * ship.speed * dt;
  ship.position.y += Math.sin(ship.heading) * ship.speed * dt;

  const collided = arena.resolveCircle(ship.position, ship.radius);
  if (collided) {
    ship.speed = Math.min(ship.speed, config.maxSpeed * 0.35);
  }
  return collided;
}
