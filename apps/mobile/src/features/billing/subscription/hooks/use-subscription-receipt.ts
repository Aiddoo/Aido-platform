import { usePurchasesSession } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useSuspenseQuery } from '@tanstack/react-query';

import { toSubscriptionReceiptViewModel } from '../utils/subscription-receipt.view-model';

/** 렌더 안 new Date()는 React Compiler가 붙잡으므로 분 시계를 읽어 켜 둔 채 결제일·만료 전날이 와도 갱신한다 */
export function useSubscriptionReceipt() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const session = usePurchasesSession();
  const { currentTimeZone } = useLocalDate();
  const now = useMinuteNow();

  return toSubscriptionReceiptViewModel(user, {
    isStoreConfigured: session.isConfigured(),
    now,
    timeZone: currentTimeZone,
  });
}
