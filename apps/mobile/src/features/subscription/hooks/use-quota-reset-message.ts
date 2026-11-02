import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useCallback } from 'react';
import { match } from 'ts-pattern';

import {
  type PremiumFeatureEntitlement,
  PremiumEntitlementPolicy,
} from '../domains/premium-entitlement.model';

/** 다 쓴 횟수가 언제 다시 채워지는지 한 줄로 알려 주는 문구. 알 수 없으면 null이다 */
export function useQuotaResetMessage() {
  const { t } = useTranslation('common');
  const dateFormatContext = useDateFormatContext();

  return useCallback(
    (quota: Pick<PremiumFeatureEntitlement, 'limit' | 'resetsAt'> | undefined) => {
      if (quota == null) {
        return null;
      }
      const notice = PremiumEntitlementPolicy.resetNotice(
        quota,
        new Date(),
        dateFormatContext.timeZone,
      );
      if (notice == null) {
        return null;
      }
      return match(notice)
        .with({ type: 'today' }, () => t('premiumDialog.resetsToday'))
        .with({ type: 'tomorrow' }, () => t('premiumDialog.resetsTomorrow'))
        .with({ type: 'date' }, ({ date }) =>
          t('premiumDialog.resetsOn', {
            date: formatDateLabel(date, 'monthDay', dateFormatContext),
          }),
        )
        .exhaustive();
    },
    [t, dateFormatContext],
  );
}
