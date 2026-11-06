import { t } from '@src/shared/i18n';

/** 리포트 도착 D-day 포맷 (0 → "오늘 생성!", N → "D-N") */
export const formatDday = (days: number): string => {
  if (days === 0) {
    return t('ai:report.dday.today');
  }
  return t('ai:report.dday.inDays', { count: days });
};
