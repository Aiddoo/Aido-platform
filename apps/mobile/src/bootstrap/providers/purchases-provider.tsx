import { WEBHOOK_SYNC_DELAY_MS } from '@src/features/billing/subscription/constants/subscription.constants';
import { type CustomerInfo } from '@src/features/billing/subscription/domains/customer-info.model';
import { CustomerInfoPolicy } from '@src/features/billing/subscription/domains/customer-info.model';
import { useRefreshOnPremiumEnd } from '@src/features/billing/subscription/hooks/use-refresh-on-premium-end';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { watchPremiumEntitlementChanges } from '@src/features/billing/subscription/queries/subscription-cache';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { type PremiumAccess } from '@src/features/identity/user/domains/premium-access.model';
import { invalidateMe } from '@src/features/identity/user/queries/user-cache';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'es-toolkit';
import { type PropsWithChildren, useCallback, useEffect, useMemo } from 'react';

import { usePurchasesSession, useSubscriptionService } from './di-context';

export function PurchasesProvider({ children }: PropsWithChildren) {
  const status = useAuthStatus();
  const session = usePurchasesSession();
  const subscriptionService = useSubscriptionService();
  const queryClient = useQueryClient();
  const isAuthenticated = status === 'authenticated';

  const syncServerAfterWebhook = useMemo(
    () =>
      debounce(() => {
        invalidateMe(queryClient);
        invalidateEntitlements(queryClient);
      }, WEBHOOK_SYNC_DELAY_MS),
    [queryClient],
  );

  // 프리미엄 의존 쿼리는 내 정보가 실제로 바뀌었을 때만 따라 갱신한다(스토어 이벤트가 없는 보상 기간 포함)
  useEffect(() => watchPremiumEntitlementChanges(queryClient), [queryClient]);

  useEffect(() => {
    session.configure();
  }, [session]);

  // 인증 게이트 위의 Provider라 사용자 조회에서 suspend하지 않도록 useSuspenseQuery 대신 useQuery를 쓴다
  const { data: user } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      session.logIn(user.id);
    }

    if (status === 'unauthenticated') {
      session.logOut();
    }
  }, [isAuthenticated, user, status, session]);

  // 프리미엄은 스토어 구독과 보상 기간을 합친 서버 값이 단일 원천이라 캐시에 쓰지 않고 내 정보·권한만 다시 불러온다
  const onCustomerInfoUpdated = useCallback(
    (customerInfo: CustomerInfo) => {
      if (CustomerInfoPolicy.hasStoreEntitlement(customerInfo)) {
        syncServerAfterWebhook();
        return;
      }

      syncServerAfterWebhook.cancel();
      invalidateMe(queryClient);
      invalidateEntitlements(queryClient);
    },
    [queryClient, syncServerAfterWebhook],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const unsubscribe = subscriptionService.subscribeCustomerInfo(onCustomerInfoUpdated);

    return () => {
      unsubscribe();
      syncServerAfterWebhook.cancel();
    };
  }, [isAuthenticated, subscriptionService, onCustomerInfoUpdated, syncServerAfterWebhook]);

  return (
    <>
      {user?.premiumAccess.endsAt != null && <PremiumEndSync access={user.premiumAccess} />}
      {children}
    </>
  );
}

/** 끝나는 시각이 있는 프리미엄일 때만 분 시계를 구독해, 무료 사용자에게는 타이머를 두지 않는다 */
function PremiumEndSync({ access }: { access: PremiumAccess }) {
  useRefreshOnPremiumEnd(access);
  return null;
}
