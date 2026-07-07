import { t } from '@src/shared/i18n';
import type { TimeFormat } from '@src/shared/utils/time';

/** 24시간 정수(0-23) → 시간 표기 (12시간: "오전 12시"/"12 AM", 24시간: "14시"/"14:00") */
export const formatHour = (hour: number, timeFormat: TimeFormat = 'TWELVE_HOUR'): string => {
  if (timeFormat === 'TWENTY_FOUR_HOUR') {
    return t('ai:report.hour.h24', { hour });
  }
  if (hour === 0) {
    return t('ai:report.hour.am', { hour: 12 });
  }
  if (hour < 12) {
    return t('ai:report.hour.am', { hour });
  }
  if (hour === 12) {
    return t('ai:report.hour.pm', { hour: 12 });
  }
  return t('ai:report.hour.pm', { hour: hour - 12 });
};

/** 리포트 도착 D-day 포맷 (0 → "오늘 생성!", N → "D-N") */
export const formatDday = (days: number): string => {
  if (days === 0) {
    return t('ai:report.dday.today');
  }
  return t('ai:report.dday.inDays', { count: days });
};
