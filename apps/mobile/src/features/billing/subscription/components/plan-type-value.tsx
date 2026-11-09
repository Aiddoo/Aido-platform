import { PremiumAccessPolicy } from '@src/features/identity/user/domains/premium-access.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Text } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match, P } from 'ts-pattern';

import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

/** 구독 관리 행의 현재 요금제. 스토어 구독이면 요금제, 아니면 지금 등급이다. 못 읽으면 값 없이 둔다 */
export function PlanTypeValue() {
  return (
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <PlanType />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function PlanType() {
  const { t } = useTranslation('subscription');
  const [{ data: me }, { data: entitlements }] = useSuspenseQueries({
    queries: [useGetMeQueryOptions(), useGetEntitlementsQueryOptions()],
  });
  const isStoreSubscribed = PremiumAccessPolicy.isStoreSubscribed(me.premiumAccess);

  return (
    <Text size="b3" shade={7} testID="plan-type-value">
      {match({ isStoreSubscribed, planType: me.premiumAccess.planType, tier: entitlements.tier })
        .with({ isStoreSubscribed: true, planType: 'annual' }, () => t('plan.annual'))
        .with({ isStoreSubscribed: true, planType: 'monthly' }, () => t('plan.monthly'))
        .with({ isStoreSubscribed: true, planType: P.nullish }, () => t('receipt.rows.planUnknown'))
        .with({ isStoreSubscribed: false, tier: 'ADMIN' }, () => t('tier.admin'))
        .with({ isStoreSubscribed: false, tier: 'PREMIUM' }, () => t('tier.premium'))
        .with({ isStoreSubscribed: false, tier: 'FREE' }, () => t('upsell.free'))
        .exhaustive()}
    </Text>
  );
}
