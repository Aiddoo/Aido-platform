import { toDateFormatLocale } from '@src/shared/date/date-format';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { formatCount } from '@src/shared/utils/format';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { type EntitlementFeature } from '../schemas/entitlement.schema';

export function useQuotaStatus(feature: EntitlementFeature) {
  const { t } = useTranslation('subscription');
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);
  const { data: snapshot } = useQuery(useGetEntitlementsQueryOptions());
  const status =
    snapshot == null
      ? { type: 'hidden' as const }
      : EntitlementPolicy.getQuotaStatus(snapshot, feature);
  const label = match(status)
    .with({ type: 'hidden' }, () => null)
    .with({ type: 'remaining' }, ({ count }) =>
      t('quota.remaining', { amount: formatCount(count, locale) }),
    )
    .with({ type: 'used-up', period: 'month' }, () => t('quota.usedUpMonth'))
    .with({ type: 'used-up', period: 'day' }, () => t('quota.usedUpDay'))
    .exhaustive();

  return { type: status.type, label };
}
