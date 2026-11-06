import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { formatCount } from '@src/shared/utils/format';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import {
  type EntitlementFeature,
  EntitlementPolicy,
  type EntitlementSnapshot,
} from '../domains/entitlement.model';

export function useRefillSentence() {
  const { t } = useTranslation('subscription');
  const dateFormatContext = useDateFormatContext();

  return useCallback(
    (snapshot: EntitlementSnapshot | undefined, feature: EntitlementFeature): string | null => {
      if (snapshot == null) {
        return null;
      }
      const limit = EntitlementPolicy.getLimit(snapshot, feature);
      const notice = EntitlementPolicy.getResetNotice(
        snapshot,
        feature,
        new Date(),
        dateFormatContext.timeZone,
      );
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
            date: formatDateLabel(date, 'monthDay', dateFormatContext),
          }),
        )
        .exhaustive();
    },
    [t, dateFormatContext],
  );
}
