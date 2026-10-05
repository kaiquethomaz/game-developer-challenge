import type { MatchOutcome } from '../game/session/GameSession';
import { isRecord, readJson, writeJson } from './localStore';

const LAST_RESULT_KEY = 'pirate-battle:last-result';

export function loadLastResult(): MatchOutcome | null {
  return readJson(LAST_RESULT_KEY, parseOutcome);
}

export function saveLastResult(outcome: MatchOutcome): void {
  writeJson(LAST_RESULT_KEY, outcome);
}

export function parseOutcome(value: unknown): MatchOutcome | null {
  if (!isRecord(value) || !isRecord(value.options)) return null;
  const { matchId, seed, score, durationSeconds, endReason, endedAt, options } = value;
  if (
    typeof matchId !== 'string' ||
    typeof seed !== 'number' ||
    typeof score !== 'number' ||
    typeof durationSeconds !== 'number' ||
    (endReason !== 'time' && endReason !== 'death') ||
    typeof endedAt !== 'string' ||
    typeof options.matchDurationSeconds !== 'number' ||
    typeof options.spawnIntervalSeconds !== 'number'
  ) {
    return null;
  }
  return {
    matchId,
    seed,
    score,
    durationSeconds,
    endReason,
    endedAt,
    options: {
      matchDurationSeconds: options.matchDurationSeconds,
      spawnIntervalSeconds: options.spawnIntervalSeconds,
    },
  };
}
