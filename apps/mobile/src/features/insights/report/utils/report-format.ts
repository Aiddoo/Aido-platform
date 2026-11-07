import { t } from '@src/shared/i18n';

export function formatDday(days: number): string {
  if (days === 0) {
    return t('ai:report.dday.today');
  }
  return t('ai:report.dday.inDays', { count: days });
}
