import type { TimeFormat } from '@src/shared/utils/time';

/** 24시간 정수(0-23) → 시간 표기 (12시간: "오전 12시", 24시간: "14시") */
export const formatHour = (hour: number, timeFormat: TimeFormat = 'TWELVE_HOUR'): string => {
  if (timeFormat === 'TWENTY_FOUR_HOUR') return `${hour}시`;
  if (hour === 0) return '오전 12시';
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return '오후 12시';
  return `오후 ${hour - 12}시`;
};

/** D-day 포맷 (0 → "오늘 생성!", N → "D-N") */
export const formatDday = (days: number): string => {
  if (days === 0) return '오늘 생성!';
  return `D-${days}`;
};
