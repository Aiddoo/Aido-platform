import { toDateFormatLocale } from '@src/shared/date/date-format';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

// 렌더 안의 new Date()는 React Compiler가 붙잡아 두므로 분 단위 시계로 한도 창 전환을 잡는다
export function useQuotaStatus(feature: EntitlementFeature) {
  const { t } = useTranslation('subscription');
  const locale = toDateFormatLocale(useLanguage().resolvedLanguage);
  const { data: snapshot, isPending } = useQuery(useGetEntitlementsQueryOptions());
  const now = useMinuteNow();
  const status =
    snapshot == null
      ? { type: 'untracked' as const }
      : EntitlementPolicy.getQuotaStatus(snapshot, feature, now);
  const label = match(status)
    .with({ type: 'untracked' }, () => null)
    .with({ type: 'remaining' }, ({ count }) =>
      t('quota.remaining', { amount: formatCount(count, locale) }),
    )
    .with({ type: 'used-up', period: 'month' }, () => t('quota.usedUpMonth'))
    .with({ type: 'used-up', period: 'day' }, () => t('quota.usedUpDay'))
    .exhaustive();

  return { status, type: status.type, label, isPending };
}
