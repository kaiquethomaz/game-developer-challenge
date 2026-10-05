import {
  DEFAULT_PLAYER_OPTIONS,
  isDifficulty,
  OPTION_LIMITS,
  type Difficulty,
  type PlayerOptions,
} from '../game/config';
import { isRecord, readJson, writeJson } from './localStore';

const OPTIONS_KEY = 'pirate-battle:options';
const PROFILE_KEY = 'pirate-battle:profile';
const SOUND_KEY = 'pirate-battle:sound';

export const CAPTAIN_NAME_LIMITS = { min: 2, max: 20 } as const;

export interface PlayerProfile {
  readonly playerId: string;
  readonly captainName: string;
}

export type OptionField = keyof PlayerOptions | 'captainName';
export type OptionErrors = Partial<Record<OptionField, string>>;

export interface OptionsDraft {
  readonly matchDurationSeconds: string;
  readonly spawnIntervalSeconds: string;
  readonly difficulty: Difficulty;
  readonly captainName: string;
}

export function loadOptions(): PlayerOptions {
  return readJson(OPTIONS_KEY, parseOptions) ?? DEFAULT_PLAYER_OPTIONS;
}

export function saveOptions(options: PlayerOptions): boolean {
  return writeJson(OPTIONS_KEY, options);
}

export function loadProfile(): PlayerProfile {
  const stored = readJson(PROFILE_KEY, parseProfile);
  if (stored) return stored;
  const profile: PlayerProfile = { playerId: crypto.randomUUID(), captainName: 'Captain You' };
  writeJson(PROFILE_KEY, profile);
  return profile;
}

export function loadSoundEnabled(): boolean {
  return readJson(SOUND_KEY, (value) => (typeof value === 'boolean' ? value : null)) ?? true;
}

export function saveSoundEnabled(enabled: boolean): void {
  writeJson(SOUND_KEY, enabled);
}

export function saveProfile(profile: PlayerProfile): boolean {
  return writeJson(PROFILE_KEY, profile);
}

export function validateOptions(
  draft: OptionsDraft,
): { options: PlayerOptions; captainName: string } | { errors: OptionErrors } {
  const errors: OptionErrors = {};

  const durationError = validateDuration(draft.matchDurationSeconds);
  if (durationError) errors.matchDurationSeconds = durationError;

  const intervalError = validateSpawnInterval(draft.spawnIntervalSeconds);
  if (intervalError) errors.spawnIntervalSeconds = intervalError;

  const captainName = draft.captainName.trim();
  const nameError = validateCaptainName(captainName);
  if (nameError) errors.captainName = nameError;

  if (Object.keys(errors).length > 0) return { errors };
  return {
    options: {
      matchDurationSeconds: Number(draft.matchDurationSeconds),
      spawnIntervalSeconds: Number(draft.spawnIntervalSeconds),
      difficulty: draft.difficulty,
    },
    captainName,
  };
}

function validateDuration(raw: string): string | null {
  const value = Number(raw);
  const { min, max } = OPTION_LIMITS.matchDurationSeconds;
  if (raw.trim() === '' || !Number.isInteger(value)) return 'Enter a whole number of seconds.';
  if (value < min || value > max) return `Choose between ${min} and ${max} seconds.`;
  return null;
}

function validateSpawnInterval(raw: string): string | null {
  const value = Number(raw);
  const { min, max, step } = OPTION_LIMITS.spawnIntervalSeconds;
  if (raw.trim() === '' || !Number.isFinite(value)) return 'Enter a number of seconds.';
  if (value < min || value > max) return `Choose between ${min} and ${max} seconds.`;
  if (Math.abs(value / step - Math.round(value / step)) > 1e-9) {
    return `Use steps of ${step} seconds.`;
  }
  return null;
}

function validateCaptainName(name: string): string | null {
  const { min, max } = CAPTAIN_NAME_LIMITS;
  if (name.length < min || name.length > max) return `Use ${min} to ${max} characters.`;
  return null;
}

function parseOptions(value: unknown): PlayerOptions | null {
  if (!isRecord(value)) return null;
  const duration = String(value.matchDurationSeconds);
  const interval = String(value.spawnIntervalSeconds);
  if (validateDuration(duration) || validateSpawnInterval(interval)) return null;
  return {
    matchDurationSeconds: Number(duration),
    spawnIntervalSeconds: Number(interval),
    difficulty: isDifficulty(value.difficulty)
      ? value.difficulty
      : DEFAULT_PLAYER_OPTIONS.difficulty,
  };
}

function parseProfile(value: unknown): PlayerProfile | null {
  if (!isRecord(value)) return null;
  const { playerId, captainName } = value;
  if (typeof playerId !== 'string' || playerId.length === 0) return null;
  if (typeof captainName !== 'string') return null;
  const trimmed = captainName.trim();
  if (validateCaptainName(trimmed)) return null;
  return { playerId, captainName: trimmed };
}
