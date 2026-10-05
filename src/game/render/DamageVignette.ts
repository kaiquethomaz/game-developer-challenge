import { Sprite, Texture } from 'pixi.js';

const TEXTURE_SIZE = 256;
const FADE_PER_SECOND = 3;

function createVignetteTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (context) {
    const half = TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, half * 0.72, half, half, half * 1.08);
    gradient.addColorStop(0, 'rgba(200, 24, 24, 0)');
    gradient.addColorStop(1, 'rgba(200, 24, 24, 1)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  }
  return Texture.from(canvas);
}

export class DamageVignette {
  readonly sprite: Sprite;
  private intensity = 0;

  constructor(private readonly peakAlpha: number) {
    this.sprite = new Sprite({ texture: createVignetteTexture(), alpha: 0, label: 'damage' });
    this.sprite.eventMode = 'none';
  }

  pulse(): void {
    this.intensity = 1;
  }

  resize(width: number, height: number): void {
    this.sprite.width = width;
    this.sprite.height = height;
  }

  update(dt: number): void {
    if (this.intensity <= 0) return;
    this.intensity = Math.max(0, this.intensity - FADE_PER_SECOND * dt);
    this.sprite.alpha = this.intensity * this.peakAlpha;
  }

  destroy(): void {
    this.sprite.destroy({ texture: true, textureSource: true });
  }
}
