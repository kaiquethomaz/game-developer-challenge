import { Container, Sprite, type Texture } from 'pixi.js';
import { healthRatio, type Ship } from '../core/entities';
import { HealthBar, type HealthBarFills } from './HealthBar';
import type { HealthBarTextures } from './textures';

const SPRITE_FORWARD_ANGLE = Math.PI / 2;
const HEALTH_BAR_SCALE = 0.42;
const HEALTH_BAR_GAP = 14;
const HIT_FLASH_SECONDS = 0.12;
const HIT_TINT = 0xff9a8a;

export function damageStage(ratio: number): number {
  if (ratio > 2 / 3) return 0;
  if (ratio > 1 / 3) return 1;
  return 2;
}

export class ShipView {
  readonly body = new Container();
  readonly healthBar: HealthBar;
  private readonly hull: Sprite;
  private readonly flames: Sprite[];
  private stage = -1;
  private flashRemaining = 0;
  private flameClock = 0;

  constructor(
    private readonly stages: readonly Texture[],
    fireTextures: readonly Texture[],
    healthTextures: HealthBarTextures,
    fills: HealthBarFills,
  ) {
    this.hull = new Sprite(stages[0]);
    this.hull.anchor.set(0.5);
    this.flames = [
      createFlame(fireTextures[0], -8, -6),
      createFlame(fireTextures[1] ?? fireTextures[0], 10, 18),
    ];
    this.body.addChild(this.hull, ...this.flames);

    this.healthBar = new HealthBar(healthTextures, fills);
    this.healthBar.scale.set(HEALTH_BAR_SCALE);
  }

  get wreckTexture(): Texture | undefined {
    return this.stages[this.stages.length - 1];
  }

  flash(): void {
    this.flashRemaining = HIT_FLASH_SECONDS;
  }

  sync(ship: Ship, dt: number): void {
    this.body.position.set(ship.position.x, ship.position.y);
    this.body.rotation = ship.heading - SPRITE_FORWARD_ANGLE;

    const ratio = healthRatio(ship);
    const stage = damageStage(ratio);
    if (stage !== this.stage) {
      this.stage = stage;
      const texture = this.stages[stage];
      if (texture) this.hull.texture = texture;
      this.flames.forEach((flame, index) => {
        flame.visible = stage > index;
      });
    }

    this.flameClock += dt;
    for (const [index, flame] of this.flames.entries()) {
      if (!flame.visible) continue;
      const flicker = Math.sin(this.flameClock * 18 + index * 2);
      flame.scale.set(0.8 + flicker * 0.1, 0.85 - flicker * 0.08);
    }

    this.flashRemaining = Math.max(0, this.flashRemaining - dt);
    this.hull.tint = this.flashRemaining > 0 ? HIT_TINT : 0xffffff;

    this.healthBar.position.set(ship.position.x, ship.position.y - ship.radius - HEALTH_BAR_GAP);
    this.healthBar.setRatio(ratio);
  }

  destroy(): void {
    this.body.destroy({ children: true });
    this.healthBar.destroy({ children: true });
  }
}

function createFlame(texture: Texture | undefined, x: number, y: number): Sprite {
  const flame = new Sprite(texture);
  flame.anchor.set(0.5, 0.9);
  flame.position.set(x, y);
  flame.visible = false;
  return flame;
}
