import type { GameSession } from '../game/session/GameSession';

export interface E2EOptions {
  readonly enabled: boolean;
  readonly seed: number | null;
  readonly manualClock: boolean;
  readonly invulnerablePlayer: boolean;
}

export interface GameStateProbe {
  readonly status: string;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly score: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly heading: number;
    readonly health: number;
    readonly alive: boolean;
    readonly cooldowns: Readonly<Record<'front' | 'left' | 'right' | 'volley', number>>;
  };
  readonly enemies: readonly {
    readonly id: number;
    readonly kind: string;
    readonly x: number;
    readonly y: number;
    readonly heading: number;
    readonly health: number;
  }[];
  readonly projectiles: readonly {
    readonly faction: string;
    readonly x: number;
    readonly y: number;
  }[];
  readonly salvage: readonly {
    readonly id: number;
    readonly x: number;
    readonly y: number;
    readonly remainingLifetime: number;
  }[];
  readonly arena: {
    readonly width: number;
    readonly height: number;
    readonly islands: readonly { x: number; y: number; width: number; height: number }[];
  };
  readonly config: { readonly matchDurationSeconds: number; readonly spawnIntervalSeconds: number };
  readonly render: {
    readonly ships: number;
    readonly projectiles: number;
    readonly effects: number;
  } | null;
}

export interface PirateBattleProbe {
  readonly getState: () => GameStateProbe;
  readonly advance: (seconds: number) => void;
}

declare global {
  interface Window {
    __pirateBattle?: PirateBattleProbe;
  }
}

export function readE2EOptions(search = window.location.search): E2EOptions {
  const params = new URLSearchParams(search);
  const enabled = params.get('e2e') === '1';
  const seed = Number(params.get('seed'));
  return {
    enabled,
    seed: enabled && Number.isInteger(seed) && params.has('seed') ? seed : null,
    manualClock: enabled && params.get('clock') === 'manual',
    invulnerablePlayer: enabled && params.get('invulnerable') === '1',
  };
}

export function exposeSession(session: GameSession): () => void {
  const probe: PirateBattleProbe = {
    getState: () => describe(session),
    advance: (seconds) => {
      session.advance(seconds);
    },
  };
  window.__pirateBattle = probe;
  return () => {
    if (window.__pirateBattle === probe) delete window.__pirateBattle;
  };
}

function describe(session: GameSession): GameStateProbe {
  const { simulation } = session;
  const { state, config, arena } = simulation;
  return {
    status: session.hud.getSnapshot().status,
    elapsedSeconds: state.elapsedSeconds,
    remainingSeconds: simulation.remainingSeconds,
    score: state.score,
    player: {
      x: state.player.position.x,
      y: state.player.position.y,
      heading: state.player.heading,
      health: state.player.health,
      alive: state.player.alive,
      cooldowns: { ...state.player.cooldowns },
    },
    enemies: state.enemies.map((enemy) => ({
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.position.x,
      y: enemy.position.y,
      heading: enemy.heading,
      health: enemy.health,
    })),
    projectiles: simulation.projectiles.active.map((projectile) => ({
      faction: projectile.faction,
      x: projectile.position.x,
      y: projectile.position.y,
    })),
    salvage: simulation.salvage.items.map((item) => ({
      id: item.id,
      x: item.position.x,
      y: item.position.y,
      remainingLifetime: item.remainingLifetime,
    })),
    arena: {
      width: arena.width,
      height: arena.height,
      islands: arena.islands.map((rect) => ({ ...rect })),
    },
    config: {
      matchDurationSeconds: config.matchDurationSeconds,
      spawnIntervalSeconds: config.spawn.intervalSeconds,
    },
    render: session.renderStats,
  };
}
