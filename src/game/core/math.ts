export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wrapAngle(angle: number): number {
  const wrapped = (((angle + Math.PI) % TAU) + TAU) % TAU;
  return wrapped - Math.PI;
}

export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSquared(a, b));
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function turnTowards(current: number, target: number, maxDelta: number): number {
  const delta = wrapAngle(target - current);
  return wrapAngle(current + clamp(delta, -maxDelta, maxDelta));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
