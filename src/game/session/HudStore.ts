import type { EndReason } from '../core/events';

export type SessionStatus = 'starting' | 'running' | 'paused' | 'ended';
export type PauseReason = 'manual' | 'focus' | 'hidden';

export interface HudSnapshot {
  readonly status: SessionStatus;
  readonly pauseReason: PauseReason | null;
  readonly score: number;
  readonly remainingSeconds: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly endReason: EndReason | null;
}

type Listener = () => void;

export class HudStore {
  private snapshot: HudSnapshot;
  private readonly listeners = new Set<Listener>();

  constructor(initial: HudSnapshot) {
    this.snapshot = initial;
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): HudSnapshot => this.snapshot;

  publish(next: HudSnapshot): void {
    if (shallowEqual(this.snapshot, next)) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.listeners.clear();
  }
}

function shallowEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.status === b.status &&
    a.pauseReason === b.pauseReason &&
    a.score === b.score &&
    a.remainingSeconds === b.remainingSeconds &&
    a.health === b.health &&
    a.maxHealth === b.maxHealth &&
    a.endReason === b.endReason
  );
}
