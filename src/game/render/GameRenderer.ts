import { Application, Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import type { Ship } from '../core/entities';
import type { SimulationEvent } from '../core/events';
import { createRandom, type Random } from '../core/random';
import type { Simulation } from '../core/simulation';
import { createArenaView } from './ArenaView';
import { EffectsLayer } from './EffectsLayer';
import { HealthBarFills } from './HealthBar';
import { ShipView } from './ShipView';
import type { GameTextures } from './textures';

const BACKGROUND_COLOR = 0x1b2a3a;
const MAX_PIXEL_RATIO = 2;
const SHAKE_DECAY_PER_SECOND = 4;

export interface RendererOptions {
  readonly seed: number;
  readonly reducedMotion: boolean;
}

export interface RenderStats {
  readonly ships: number;
  readonly projectiles: number;
  readonly effects: number;
}

export class GameRenderer {
  private readonly world = new Container({ label: 'world' });
  private readonly shipLayer = new Container({ label: 'ships' });
  private readonly projectileLayer = new Container({ label: 'projectiles' });
  private readonly effects = new EffectsLayer({ label: 'effects' });
  private readonly overlayLayer = new Container({ label: 'overlays' });
  private readonly shipViews = new Map<number, ShipView>();
  private readonly projectileSprites: Sprite[] = [];
  private readonly random: Random;
  private readonly playerFills: HealthBarFills;
  private readonly enemyFills: HealthBarFills;
  private ringTexture: Texture | null = null;
  private puffTexture: Texture | null = null;
  private shake = 0;
  private destroyed = false;

  private constructor(
    private readonly app: Application,
    private readonly textures: GameTextures,
    private readonly simulation: Simulation,
    private readonly options: RendererOptions,
  ) {
    this.random = createRandom(options.seed);
    this.playerFills = new HealthBarFills(textures.playerHealth);
    this.enemyFills = new HealthBarFills(textures.enemyHealth);
  }

  static async create(
    host: HTMLElement,
    textures: GameTextures,
    simulation: Simulation,
    options: RendererOptions,
  ): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: BACKGROUND_COLOR,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
      preference: 'webgl',
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);

    const renderer = new GameRenderer(app, textures, simulation, options);
    renderer.build();
    return renderer;
  }

  get ticker(): Ticker {
    return this.app.ticker;
  }

  get stats(): RenderStats {
    return {
      ships: this.shipViews.size,
      projectiles: this.simulation.projectiles.active.length,
      effects: this.effects.activeCount,
    };
  }

  render(events: readonly SimulationEvent[], dt: number): void {
    if (this.destroyed) return;
    for (const event of events) this.handleEvent(event);
    this.syncShips(dt);
    this.syncProjectiles();
    this.effects.update(dt);
    this.updateShake(dt);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.renderer.off('resize', this.layout);
    for (const view of this.shipViews.values()) view.destroy();
    this.shipViews.clear();
    this.playerFills.destroy();
    this.enemyFills.destroy();
    this.ringTexture?.destroy(true);
    this.puffTexture?.destroy(true);
    this.app.destroy(
      { removeView: true },
      { children: true, texture: false, textureSource: false },
    );
  }

  private build(): void {
    const { arena } = this.simulation;
    this.world.addChild(
      createArenaView(arena, this.simulation.config.arena.islands, this.textures),
      this.shipLayer,
      this.projectileLayer,
      this.effects,
      this.overlayLayer,
    );
    this.app.stage.addChild(this.world);

    this.ringTexture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, 24).stroke({ width: 4, color: 0xffffff }),
    );
    this.puffTexture = this.app.renderer.generateTexture(
      new Graphics().circle(0, 0, 14).fill({ color: 0xe8e2d6 }),
    );

    this.app.renderer.on('resize', this.layout);
    this.layout();
    this.syncShips(0);
  }

  private readonly layout = (): void => {
    const { width, height } = this.app.screen;
    const { arena } = this.simulation;
    const scale = Math.min(width / arena.width, height / arena.height);
    this.world.scale.set(scale);
    this.world.position.set((width - arena.width * scale) / 2, (height - arena.height * scale) / 2);
  };

  private syncShips(dt: number): void {
    const { player, enemies } = this.simulation.state;
    const seen = new Set<number>();
    this.syncShip(player, dt, seen);
    for (const enemy of enemies) this.syncShip(enemy, dt, seen);

    for (const [id, view] of this.shipViews) {
      if (!seen.has(id)) {
        view.destroy();
        this.shipViews.delete(id);
      }
    }
  }

  private syncShip(ship: Ship, dt: number, seen: Set<number>): void {
    if (!ship.alive && ship.kind !== 'player') return;
    seen.add(ship.id);

    let view = this.shipViews.get(ship.id);
    if (!view) {
      const isPlayer = ship.kind === 'player';
      view = new ShipView(
        this.textures.ships[ship.kind],
        this.textures.fire,
        isPlayer ? this.textures.playerHealth : this.textures.enemyHealth,
        isPlayer ? this.playerFills : this.enemyFills,
      );
      this.shipLayer.addChild(view.body);
      this.overlayLayer.addChild(view.healthBar);
      this.shipViews.set(ship.id, view);
    }
    view.sync(ship, dt);
    view.body.visible = ship.alive;
    view.healthBar.visible = ship.alive;
  }

  private syncProjectiles(): void {
    const projectiles = this.simulation.projectiles.active;
    while (this.projectileSprites.length < projectiles.length) {
      const sprite = new Sprite(this.textures.cannonBall);
      sprite.anchor.set(0.5);
      this.projectileLayer.addChild(sprite);
      this.projectileSprites.push(sprite);
    }
    for (const [index, sprite] of this.projectileSprites.entries()) {
      const projectile = projectiles[index];
      sprite.visible = projectile !== undefined;
      if (projectile) sprite.position.set(projectile.position.x, projectile.position.y);
    }
  }

  private handleEvent(event: SimulationEvent): void {
    switch (event.type) {
      case 'shot':
        this.spawnMuzzle(event.x, event.y, event.angle, event.slot === 'front' ? 1 : 3);
        break;
      case 'hit':
        this.shipViews.get(event.targetId)?.flash();
        this.effects.spawn({
          frames: this.textures.explosion.slice(0, 1),
          x: event.x,
          y: event.y,
          duration: 0.25,
          scaleFrom: 0.25,
          scaleTo: 0.55,
          alphaFrom: 1,
        });
        break;
      case 'splash':
        this.spawnSplash(event.x, event.y);
        break;
      case 'destroyed':
        this.spawnDestruction(event.id, event.x, event.y);
        break;
      case 'playerDamaged':
        this.addShake(10);
        break;
      case 'islandBump':
        this.addShake(4);
        break;
      case 'spawned':
      case 'scored':
      case 'ended':
        break;
    }
  }

  private spawnMuzzle(x: number, y: number, angle: number, count: number): void {
    const puff = this.puffTexture;
    for (let i = 0; i < count; i += 1) {
      this.effects.spawn({
        frames: this.textures.explosion.slice(0, 1),
        x,
        y,
        duration: 0.14,
        scaleFrom: 0.22,
        scaleTo: 0.42,
        alphaFrom: 1,
      });
      if (puff) {
        this.effects.spawn({
          frames: [puff],
          x,
          y,
          duration: 0.6,
          velocityX: Math.cos(angle) * 40 + this.random.range(-12, 12),
          velocityY: Math.sin(angle) * 40 + this.random.range(-12, 12),
          scaleFrom: 0.4,
          scaleTo: 1.1,
          alphaFrom: 0.55,
        });
      }
    }
  }

  private spawnSplash(x: number, y: number): void {
    if (!this.ringTexture) return;
    this.effects.spawn({
      frames: [this.ringTexture],
      x,
      y,
      duration: 0.45,
      scaleFrom: 0.2,
      scaleTo: 0.9,
      alphaFrom: 0.8,
    });
  }

  private spawnDestruction(id: number, x: number, y: number): void {
    const view = this.shipViews.get(id);
    const wreck = view?.wreckTexture;
    if (wreck) {
      this.effects.spawn({
        frames: [wreck],
        x,
        y,
        rotation: view.body.rotation,
        duration: 1.4,
        scaleFrom: 1,
        scaleTo: 0.55,
        alphaFrom: 1,
      });
    }
    this.effects.spawn({
      frames: this.textures.explosion,
      x,
      y,
      duration: 0.6,
      scaleFrom: 0.7,
      scaleTo: 1.4,
      alphaFrom: 1,
    });
    for (let i = 0; i < 6; i += 1) {
      const angle = this.random.range(0, Math.PI * 2);
      const speed = this.random.range(60, 160);
      this.effects.spawn({
        frames: [this.random.pick(this.textures.debris)],
        x,
        y,
        rotation: angle,
        duration: 0.9,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        spin: this.random.range(-6, 6),
        scaleFrom: 0.9,
        scaleTo: 0.5,
        alphaFrom: 1,
      });
    }
    this.addShake(6);
  }

  private addShake(amount: number): void {
    if (this.options.reducedMotion) return;
    this.shake = Math.max(this.shake, amount);
  }

  private updateShake(dt: number): void {
    this.layout();
    if (this.shake <= 0.1) {
      this.shake = 0;
      return;
    }
    this.world.x += this.random.range(-this.shake, this.shake);
    this.world.y += this.random.range(-this.shake, this.shake);
    this.shake *= Math.exp(-SHAKE_DECAY_PER_SECOND * dt * 2);
  }
}
