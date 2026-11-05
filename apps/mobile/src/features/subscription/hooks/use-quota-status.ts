import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { toDateFormatLocale } from '@src/shared/utils/date-format';
import { formatCount } from '@src/shared/utils/format';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { type EntitlementFeature, EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/get-entitlements-query-options';

/** 남은 횟수 상태와 문구. 무제한·공정 사용 한도·아직 모를 때는 `hidden`이고 문구가 없다 */
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
