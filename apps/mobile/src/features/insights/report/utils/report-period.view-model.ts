import { parseDateKey } from '@src/shared/date/date-key';
import { type DateFormatContext, formatDateKeyLabel } from '@src/shared/date/format/date-format';
import { t } from '@src/shared/i18n';
import { toLanguageOfIntlLocale } from '@src/shared/i18n/app-locales';

import type { AiReport } from '../domains/report.model';

/** 서버가 보낸 기간 라벨은 만든 시점의 언어로 굳어 있어 연도와 기간 번호로 앱 언어에 맞게 만든다 */
export function formatReportPeriodLabel(
  { type, year, period }: Pick<AiReport, 'type' | 'year' | 'period'>,
  context: DateFormatContext,
): string {
  if (type === 'WEEKLY') {
    return t('ai:report.weeklyPeriodLabel', {
      lng: toLanguageOfIntlLocale(context.locale),
      year,
      period,
    });
  }
  const monthStartDateKey = parseDateKey(`${year}-${String(period).padStart(2, '0')}-01`);
  return monthStartDateKey == null
    ? ''
    : formatDateKeyLabel(monthStartDateKey, 'yearMonth', context);
}
