import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import { formatCount } from '@src/shared/utils/number-format';
import { match } from 'ts-pattern';

import { type EntitlementSnapshot } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { type EntitlementFeature } from '../domains/feature-quota.model';

/** 한도가 다시 차는 때를 문장으로 쓴다. 지금은 부르는 쪽이 넘긴다(화면은 분 시계, 누름은 누른 순간) */
export function useFormatRefillSentence() {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return (
    snapshot: EntitlementSnapshot | undefined,
    feature: EntitlementFeature,
    now: Instant,
  ): string | null => {
    if (snapshot == null) {
      return null;
    }
    const limit = EntitlementPolicy.findLimit(snapshot, feature);
    const notice = EntitlementPolicy.findResetNotice(snapshot, feature, {
      now,
      timezone: dateFormatContext.timezone,
    });
    if (limit == null || notice == null) {
      return null;
    }
    const amount = formatCount(limit, dateFormatContext.locale);
    return match(notice)
      .with({ type: 'today' }, () => t('gate.refillToday', { amount }))
      .with({ type: 'tomorrow' }, () => t('gate.refillTomorrow', { amount }))
      .with({ type: 'date' }, ({ date }) =>
        t('gate.refillOn', {
          amount,
          date: formatYearAwareDateLabel(date, todayKey, dateFormatContext),
        }),
      )
      .exhaustive();
  };
}
