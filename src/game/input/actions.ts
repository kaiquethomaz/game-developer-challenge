export const GAME_ACTIONS = [
  'thrust',
  'turnLeft',
  'turnRight',
  'fireFront',
  'fireLeft',
  'fireRight',
  'fireVolley',
] as const;

export type GameAction = (typeof GAME_ACTIONS)[number];

export const KEY_BINDINGS: Readonly<Record<string, GameAction>> = {
  KeyW: 'thrust',
  ArrowUp: 'thrust',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyJ: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
  KeyR: 'fireVolley',
  KeyK: 'fireVolley',
};

export const ACTION_LABELS: Readonly<Record<GameAction, string>> = {
  thrust: 'Sail forward',
  turnLeft: 'Turn left',
  turnRight: 'Turn right',
  fireFront: 'Fire front cannon',
  fireLeft: 'Fire left broadside',
  fireRight: 'Fire right broadside',
  fireVolley: 'Fire triple volley',
};

export const ACTION_KEY_HINTS: Readonly<Record<GameAction, readonly string[]>> = {
  thrust: ['W', '↑'],
  turnLeft: ['A', '←'],
  turnRight: ['D', '→'],
  fireFront: ['Space', 'J'],
  fireLeft: ['Q'],
  fireRight: ['E'],
  fireVolley: ['R', 'K'],
};
