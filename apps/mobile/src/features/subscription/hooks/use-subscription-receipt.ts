import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useSuspenseQuery } from '@tanstack/react-query';

import { toSubscriptionReceiptViewModel } from '../utils/view-models/subscription-receipt.view-model';

/** 내 정보와 기기 시간대로 프리미엄 영수증을 만든다. 날짜가 바뀌면 provider가 다시 그린다 */
export function useSubscriptionReceipt() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const sdkManager = useRevenueCatSdkManager();
  const { currentTimeZone } = useLocalDate();

  return toSubscriptionReceiptViewModel(user, {
    isStoreConfigured: sdkManager.isConfigured(),
    now: new Date(),
    timeZone: currentTimeZone,
  });
}
