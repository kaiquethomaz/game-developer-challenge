import { Container, Sprite, type Texture } from 'pixi.js';
import type { Salvage } from '../core/salvage';

const BOB_SPEED = 3;
const BOB_SCALE = 0.06;
const GLOW_COLOR = 0x7dff9b;
const EXPIRY_WARNING_SECONDS = 3;
const BLINK_SPEED = 10;

interface SalvageView {
  readonly root: Container;
  readonly glow: Sprite;
}

export interface SalvageTextures {
  readonly planks: readonly [Texture, Texture];
  readonly ring: Texture;
  readonly disc: Texture;
}

export class SalvageLayer extends Container {
  private readonly views = new Map<number, SalvageView>();
  private readonly free: SalvageView[] = [];
  private clock = 0;

  constructor(
    private readonly textures: SalvageTextures,
    private readonly animate: boolean,
  ) {
    super({ label: 'salvage' });
  }

  sync(items: readonly Salvage[], dt: number): void {
    this.clock += dt;
    const seen = new Set<number>();

    for (const salvage of items) {
      seen.add(salvage.id);
      let view = this.views.get(salvage.id);
      if (!view) {
        view = this.free.pop() ?? this.createView();
        view.root.visible = true;
        this.views.set(salvage.id, view);
      }
      view.root.position.set(salvage.position.x, salvage.position.y);
      const phase = this.clock * BOB_SPEED + salvage.id;
      view.root.scale.set(this.animate ? 1 + Math.sin(phase) * BOB_SCALE : 1);
      view.glow.alpha = this.animate ? 0.8 + Math.sin(phase * 1.3) * 0.2 : 0.8;
      const expiring = salvage.remainingLifetime < EXPIRY_WARNING_SECONDS;
      view.root.alpha = expiring && Math.sin(this.clock * BLINK_SPEED) < 0 ? 0.35 : 1;
    }

    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.root.visible = false;
      this.views.delete(id);
      this.free.push(view);
    }
  }

  private createView(): SalvageView {
    const root = new Container();
    const { planks, ring, disc } = this.textures;
    const halo = new Sprite({ texture: disc, anchor: 0.5, tint: GLOW_COLOR, alpha: 0.35 });
    const glow = new Sprite({ texture: ring, anchor: 0.5, tint: GLOW_COLOR, scale: 1.1 });
    const lower = new Sprite({ texture: planks[0], anchor: 0.5, rotation: 0.5, scale: 0.85 });
    const upper = new Sprite({ texture: planks[1], anchor: 0.5, rotation: -0.6, scale: 0.85 });
    root.addChild(halo, glow, lower, upper);
    this.addChild(root);
    return { root, glow };
  }
}
