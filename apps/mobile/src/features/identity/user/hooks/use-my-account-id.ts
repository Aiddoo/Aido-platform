import { useQuery } from '@tanstack/react-query';

import { selectAccountId, useGetMeQueryOptions } from '../queries/user.queries';

interface UseMyAccountIdOptions {
  /** 인증 전에는 끈다. 미인증에서 내 정보를 부르면 401이 세션 만료로 번진다 */
  isEnabled?: boolean;
}

/** id만 고르므로 내 정보의 다른 칸이 바뀌어도 다시 그리지 않는다. 읽기 전·실패·꺼짐은 null이고 던지지 않는다 */
export function useMyAccountId({ isEnabled = true }: UseMyAccountIdOptions = {}): string | null {
  const { data: accountId } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: isEnabled,
    throwOnError: false,
    select: selectAccountId,
  });

  // 꺼진 쿼리도 지난 세션의 캐시를 돌려줄 수 있어 꺼져 있으면 버린다
  return isEnabled ? (accountId ?? null) : null;
}
