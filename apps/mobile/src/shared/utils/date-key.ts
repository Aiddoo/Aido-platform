import { formatDateKey } from './date-format';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD에 달력 일수를 더한다 (윤년·월말·연말 포함, 시간대 무관). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  return formatDateKey(new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS), 'UTC');
}
