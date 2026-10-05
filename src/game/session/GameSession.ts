import type { GameConfig, PlayerOptions } from '../config';
import { createIdleIntent } from '../core/entities';
import type { EndReason, SimulationEvent } from '../core/events';
import { FixedStepAccumulator } from '../core/fixedStep';
import { Simulation } from '../core/simulation';
import { InputController } from '../input/InputController';
import { KeyboardInput } from '../input/KeyboardInput';
import { GameRenderer, type RenderStats } from '../render/GameRenderer';
import type { GameTextures } from '../render/textures';
import { HudStore, type HudSnapshot, type PauseReason } from './HudStore';

export type ClockMode = 'realtime' | 'manual';

const MANUAL_CLOCK_MAX_FPS = 20;

export interface MatchOutcome {
  readonly matchId: string;
  readonly seed: number;
  readonly score: number;
  readonly durationSeconds: number;
  readonly endReason: EndReason;
  readonly options: PlayerOptions;
  readonly endedAt: string;
  readonly assisted: boolean;
}

export interface GameSessionOptions {
  readonly config: GameConfig;
  readonly options: PlayerOptions;
  readonly seed: number;
  readonly textures: GameTextures;
  readonly clock: ClockMode;
  readonly reducedMotion: boolean;
  readonly invulnerablePlayer?: boolean;
  readonly onEnd: (outcome: MatchOutcome) => void;
}

type EventListener = (events: readonly SimulationEvent[]) => void;

export class GameSession {
  readonly input = new InputController();
  readonly hud: HudStore;
  readonly simulation: Simulation;
  private readonly keyboard = new KeyboardInput(this.input);
  private readonly accumulator: FixedStepAccumulator;
  private readonly intent = createIdleIntent();
  private readonly pendingEvents: SimulationEvent[] = [];
  private readonly eventListeners = new Set<EventListener>();
  private renderer: GameRenderer | null = null;
  private pauseReason: PauseReason | null = null;
  private disposed = false;
  private ended = false;
  private skipNextFrame = false;

  constructor(private readonly options: GameSessionOptions) {
    this.simulation = new Simulation(options.config, options.seed, {
      invulnerablePlayer: options.invulnerablePlayer ?? false,
    });
    this.accumulator = new FixedStepAccumulator({
      stepSeconds: options.config.fixedStepSeconds,
      maxFrameSeconds: options.config.maxFrameSeconds,
    });
    this.hud = new HudStore(this.createSnapshot('starting'));
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get renderStats(): RenderStats | null {
    return this.renderer?.stats ?? null;
  }

  async mount(host: HTMLElement): Promise<void> {
    const renderer = await GameRenderer.create(host, this.options.textures, this.simulation, {
      seed: this.options.seed,
      reducedMotion: this.options.reducedMotion,
    });
    if (this.disposed) {
      renderer.destroy();
      return;
    }

    this.renderer = renderer;
    if (this.options.clock === 'manual') renderer.ticker.maxFPS = MANUAL_CLOCK_MAX_FPS;
    renderer.ticker.add(this.tick);
    this.keyboard.attach();
    this.keyboard.setEnabled(true);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleBlur);
    this.publish();
  }

  onEvents(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  pause(reason: PauseReason): void {
    if (this.disposed || this.ended || this.pauseReason) return;
    this.pauseReason = reason;
    this.input.releaseAll();
    this.keyboard.setEnabled(false);
    this.accumulator.reset();
    this.publish();
  }

  resume(): void {
    if (this.disposed || this.ended || !this.pauseReason) return;
    this.pauseReason = null;
    this.input.releaseAll();
    this.accumulator.reset();
    this.skipNextFrame = true;
    this.keyboard.setEnabled(true);
    this.publish();
  }

  advance(seconds: number): void {
    if (this.options.clock !== 'manual' || this.pauseReason || this.ended) return;
    const { fixedStepSeconds } = this.options.config;
    const steps = Math.round(seconds / fixedStepSeconds);
    for (let i = 0; i < steps; i += 1) this.stepOnce(fixedStepSeconds);
    this.flushFrame(steps * fixedStepSeconds);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    this.keyboard.detach();
    this.input.releaseAll();
    this.renderer?.ticker.remove(this.tick);
    this.renderer?.destroy();
    this.renderer = null;
    this.simulation.projectiles.clear();
    this.eventListeners.clear();
    this.hud.clear();
  }

  private readonly tick = (ticker: { deltaMS: number }): void => {
    const frameSeconds = ticker.deltaMS / 1000;
    const isRunning = !this.pauseReason && !this.ended;

    if (this.skipNextFrame) {
      this.skipNextFrame = false;
    } else if (isRunning && this.options.clock === 'realtime') {
      this.accumulator.advance(frameSeconds, this.stepOnce);
    }
    this.flushFrame(isRunning ? frameSeconds : 0);
  };

  private readonly stepOnce = (dt: number): void => {
    this.input.readIntent(this.intent);
    this.simulation.step(dt, this.intent);
    for (const event of this.simulation.drainEvents()) this.pendingEvents.push(event);
  };

  private flushFrame(visualSeconds: number): void {
    const events = this.pendingEvents.splice(0);
    this.renderer?.render(events, visualSeconds);
    if (events.length > 0) {
      for (const listener of this.eventListeners) listener(events);
    }
    this.publish();
    if (!this.ended && this.simulation.state.status === 'ended') this.finish();
  }

  private finish(): void {
    this.ended = true;
    this.keyboard.setEnabled(false);
    this.input.releaseAll();
    const { state } = this.simulation;
    this.publish();
    this.options.onEnd({
      matchId: crypto.randomUUID(),
      seed: this.options.seed,
      score: state.score,
      durationSeconds: Math.round(state.elapsedSeconds * 1000) / 1000,
      endReason: state.endReason ?? 'time',
      options: this.options.options,
      endedAt: new Date().toISOString(),
      assisted: this.options.invulnerablePlayer ?? false,
    });
  }

  private publish(): void {
    this.hud.publish(
      this.createSnapshot(this.ended ? 'ended' : this.pauseReason ? 'paused' : 'running'),
    );
  }

  private createSnapshot(status: HudSnapshot['status']): HudSnapshot {
    const { state } = this.simulation;
    return {
      status,
      pauseReason: this.pauseReason,
      score: state.score,
      remainingSeconds: Math.ceil(this.simulation.remainingSeconds - 1e-6),
      health: Math.ceil(state.player.health),
      maxHealth: state.player.maxHealth,
      endReason: state.endReason,
    };
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.pause('hidden');
  };

  private readonly handleBlur = (): void => {
    this.pause('focus');
  };
}
