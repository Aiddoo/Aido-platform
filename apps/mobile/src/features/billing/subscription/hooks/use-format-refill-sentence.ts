import { getNowInstant } from '@src/shared/date/clock';
import { formatYearAwareDateLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { formatCount } from '@src/shared/utils/number-format';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import { type EntitlementFeature, type EntitlementSnapshot } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';

export function useFormatRefillSentence() {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();

  return useCallback(
    (snapshot: EntitlementSnapshot | undefined, feature: EntitlementFeature): string | null => {
      if (snapshot == null) {
        return null;
      }
      const limit = EntitlementPolicy.getLimit(snapshot, feature);
      const notice = EntitlementPolicy.getResetNotice(snapshot, feature, {
        now: getNowInstant(),
        timeZone: dateFormatContext.timeZone,
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
    },
    [t, dateFormatContext, todayKey],
  );
}
