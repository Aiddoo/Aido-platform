import { SECOND_MS } from '@src/shared/constants/time-units';

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3_600;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatMediaTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / SECOND_MS));
  const hours = Math.floor(totalSeconds / HOUR_SECONDS);
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS);
  const seconds = totalSeconds % MINUTE_SECONDS;

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
