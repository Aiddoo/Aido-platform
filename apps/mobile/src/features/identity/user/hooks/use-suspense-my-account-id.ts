import { useSuspenseQuery } from '@tanstack/react-query';

import { selectAccountId, useGetMeQueryOptions } from '../queries/user.queries';

/** 경계 안에서 내 계정 id만 읽는다. 내 정보의 다른 칸(이름·사진·구독)이 바뀌어도 다시 그리지 않는다 */
export function useSuspenseMyAccountId(): string {
  const { data: accountId } = useSuspenseQuery({
    ...useGetMeQueryOptions(),
    select: selectAccountId,
  });

  return accountId;
}
