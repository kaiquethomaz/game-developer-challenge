import type { MatchEndReason } from '../api/contracts';

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds} seconds`;
  return seconds === 0 ? `${minutes} minutes` : `${minutes} minutes ${seconds} seconds`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatPlayedAt(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' };
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${day} ${MONTHS[date.getMonth()] ?? ''}`, time: `${hours}:${minutes}` };
}

export function endReasonLabel(reason: MatchEndReason): string {
  return reason === 'time' ? 'Time up' : 'Defeated';
}
