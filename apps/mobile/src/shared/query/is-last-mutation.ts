import type { MutationKey, QueryClient } from '@tanstack/react-query';

/**
 * 지금 끝나는 변경이 같은 키 묶음의 마지막이면 true. 앞 응답이 뒤에 바꾼 낙관적 값을 덮지 않게 마지막만 응답을 쓰거나 다시 받는다.
 * mutation 콜백 안에서 불러 자기 자신까지 센다
 */
export function isLastMutation(queryClient: QueryClient, mutationKey: MutationKey): boolean {
  return queryClient.isMutating({ mutationKey }) === 1;
}
