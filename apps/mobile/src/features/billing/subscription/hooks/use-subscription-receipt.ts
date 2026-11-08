import { usePurchasesSession } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useSuspenseQuery } from '@tanstack/react-query';

import { toSubscriptionReceiptViewModel } from '../utils/subscription-receipt.view-model';

/**
 * 내 정보와 기기 시간대로 프리미엄 영수증을 만든다.
 * 렌더 안의 new Date()는 React Compiler가 렌더 사이에 붙잡아 두므로, 분 단위로 바뀌는 시계를 읽어
 * 앱을 켜 둔 채 결제일이 지나거나 만료 하루 전이 되어도 영수증이 갱신된다
 */
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
