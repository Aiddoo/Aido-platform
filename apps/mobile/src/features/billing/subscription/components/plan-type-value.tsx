import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { toPlanTypeLabelKey } from '../utils/plan-type-label.view-model';

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

  return (
    <SettingsListGroup.Value testID="plan-type-value">
      {t(toPlanTypeLabelKey(me.premiumAccess, entitlements))}
    </SettingsListGroup.Value>
  );
}
