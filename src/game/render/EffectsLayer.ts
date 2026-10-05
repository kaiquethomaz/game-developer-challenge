import { Container, Sprite, type Texture } from 'pixi.js';

export interface EffectOptions {
  readonly frames: readonly Texture[];
  readonly x: number;
  readonly y: number;
  readonly duration: number;
  readonly rotation?: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly spin?: number;
  readonly scaleFrom?: number;
  readonly scaleTo?: number;
  readonly alphaFrom?: number;
  readonly alphaTo?: number;
  readonly tint?: number;
}

interface ActiveEffect {
  sprite: Sprite;
  options: EffectOptions;
  age: number;
}

export class EffectsLayer extends Container {
  private readonly active: ActiveEffect[] = [];
  private readonly free: Sprite[] = [];

  get activeCount(): number {
    return this.active.length;
  }

  spawn(options: EffectOptions): void {
    const firstFrame = options.frames[0];
    if (!firstFrame) return;

    const sprite = this.free.pop() ?? this.createSprite();
    sprite.texture = firstFrame;
    sprite.position.set(options.x, options.y);
    sprite.rotation = options.rotation ?? 0;
    sprite.tint = options.tint ?? 0xffffff;
    sprite.visible = true;
    this.active.push({ sprite, options, age: 0 });
    this.apply(sprite, options, 0);
  }

  update(dt: number): void {
    let writeIndex = 0;
    for (const effect of this.active) {
      effect.age += dt;
      const { sprite, options } = effect;
      const progress = effect.age / options.duration;

      if (progress >= 1) {
        sprite.visible = false;
        this.free.push(sprite);
        continue;
      }

      sprite.x += (options.velocityX ?? 0) * dt;
      sprite.y += (options.velocityY ?? 0) * dt;
      sprite.rotation += (options.spin ?? 0) * dt;
      const frame =
        options.frames[
          Math.min(options.frames.length - 1, Math.floor(progress * options.frames.length))
        ];
      if (frame && sprite.texture !== frame) sprite.texture = frame;
      this.apply(sprite, options, progress);
      this.active[writeIndex] = effect;
      writeIndex += 1;
    }
    this.active.length = writeIndex;
  }

  clear(): void {
    for (const effect of this.active) {
      effect.sprite.visible = false;
      this.free.push(effect.sprite);
    }
    this.active.length = 0;
  }

  private apply(sprite: Sprite, options: EffectOptions, progress: number): void {
    const scale = lerp(options.scaleFrom ?? 1, options.scaleTo ?? 1, progress);
    sprite.scale.set(scale);
    sprite.alpha = lerp(options.alphaFrom ?? 1, options.alphaTo ?? 0, progress);
  }

  private createSprite(): Sprite {
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    this.addChild(sprite);
    return sprite;
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
