import { useQuery } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';

type FeatureAccessStatus = 'loading' | 'error' | 'premium' | 'free';

/**
 * 프리미엄 기능 화면이 고를 상태. 권한을 기다리느라 화면 전체가 막히지 않게 Suspense 없이 읽는다.
 * 영속 캐시가 있으면 첫 렌더부터 값이 있다.
 */
export function useFeatureAccess(feature: EntitlementFeature) {
  const entitlementsQuery = useQuery(useGetEntitlementsQueryOptions());
  const status = match<typeof entitlementsQuery.data, FeatureAccessStatus>(entitlementsQuery.data)
    .with(P.nullish, () => (entitlementsQuery.isError ? 'error' : 'loading'))
    .otherwise((entitlements) =>
      EntitlementPolicy.canUseFeature(entitlements, feature) ? 'premium' : 'free',
    );

  return { status, error: entitlementsQuery.error, refetch: entitlementsQuery.refetch };
}
