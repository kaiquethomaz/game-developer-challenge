import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { HealthBarTextures } from './textures';

const FILL_STEPS = 40;

export class HealthBarFills {
  private readonly cache = new Map<number, Texture>();

  constructor(private readonly textures: HealthBarTextures) {}

  get(ratio: number): Texture {
    const step = Math.round(Math.min(1, Math.max(0, ratio)) * FILL_STEPS);
    const cached = this.cache.get(step);
    if (cached) return cached;

    const { fill, fillRect } = this.textures;
    const width = fillRect.x + (fillRect.width * step) / FILL_STEPS;
    const texture = new Texture({
      source: fill.source,
      frame: new Rectangle(fill.frame.x, fill.frame.y, Math.max(1, width), fill.frame.height),
    });
    this.cache.set(step, texture);
    return texture;
  }

  destroy(): void {
    for (const texture of this.cache.values()) texture.destroy(false);
    this.cache.clear();
  }
}

export class HealthBar extends Container {
  private readonly fill: Sprite;
  private ratio = -1;

  constructor(
    textures: HealthBarTextures,
    private readonly fills: HealthBarFills,
  ) {
    super();
    const frame = new Sprite(textures.frame);
    this.fill = new Sprite(fills.get(1));
    this.addChild(frame, this.fill);
    this.pivot.set(textures.frame.width / 2, textures.frame.height / 2);
  }

  setRatio(ratio: number): void {
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.fill.texture = this.fills.get(ratio);
    this.fill.visible = ratio > 0;
  }
}
