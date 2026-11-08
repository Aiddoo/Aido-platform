import { toDateFormatLocale } from '@src/shared/date/date-format';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { formatCount } from '@src/shared/utils/number-format';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { type EntitlementFeature } from '../schemas/entitlement.schema';

/**
 * 서버 한도로 본 남은 횟수와 기본 문구. 한도 창(일·월)이 바뀌는 순간을 놓치지 않게 분 단위 지금으로
 * 계산한다. 렌더 중 읽은 지금은 React Compiler가 값을 붙잡아 다시 계산되지 않는다
 */
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
