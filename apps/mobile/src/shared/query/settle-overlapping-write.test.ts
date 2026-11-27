import { createPendingResponse, createTestQueryClient } from '@src/testing/core';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';

import { settleOverlappingWrite } from './settle-overlapping-write';

const WRITES_KEY = ['preference', 'mutation', 'write'] as const;
const QUERY_KEY = ['preference', 'current'] as const;

/** 같은 묶음의 변경 하나를 띄우고, 끝날 때 `settleOverlappingWrite`가 고른 길을 적는다 */
function startWrite(
  queryClient: QueryClient,
  { startedWithOthers, written }: { startedWithOthers: boolean; written: string[] },
  response: string,
) {
  const pending = createPendingResponse(response);
  const running = queryClient
    .getMutationCache()
    .build(queryClient, {
      mutationKey: WRITES_KEY,
      mutationFn: () => pending.response,
      onSuccess: (saved: string) =>
        settleOverlappingWrite(queryClient, {
          mutationKey: WRITES_KEY,
          queryKey: QUERY_KEY,
          startedWithOthers,
          writeResponse: () => {
            written.push(saved);
            queryClient.setQueryData(QUERY_KEY, saved);
          },
        }),
    })
    .execute(undefined);
  return async () => {
    pending.settle();
    await running;
  };
}

function observe(queryClient: QueryClient) {
  const fetchServer = jest.fn(async () => 'server');
  queryClient.setQueryData(QUERY_KEY, 'optimistic');
  const unsubscribe = new QueryObserver(queryClient, {
    queryKey: QUERY_KEY,
    queryFn: fetchServer,
    staleTime: Infinity,
  }).subscribe(noop);
  return { fetchServer, unsubscribe };
}

describe('settleOverlappingWrite', () => {
  it('혼자 끝난 변경은 응답을 쓰고 다시 받지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const { fetchServer, unsubscribe } = observe(queryClient);
    const written: string[] = [];
    const finish = startWrite(queryClient, { startedWithOthers: false, written }, 'saved');

    // When
    await finish();

    // Then
    expect(written).toEqual(['saved']);
    expect(fetchServer).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('겹친 두 변경은 응답을 쓰지 않고, 앞 변경은 낡음만 표시하고 마지막 변경이 한 번 다시 받는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const { fetchServer, unsubscribe } = observe(queryClient);
    const written: string[] = [];
    const finishFirst = startWrite(queryClient, { startedWithOthers: false, written }, 'first');
    const finishSecond = startWrite(queryClient, { startedWithOthers: true, written }, 'second');

    // When
    await finishSecond();
    const isStaleAfterFirstResponse = queryClient.getQueryState(QUERY_KEY)?.isInvalidated;
    const fetchesAfterFirstResponse = fetchServer.mock.calls.length;
    await finishFirst();

    // Then
    expect(isStaleAfterFirstResponse).toBe(true);
    expect(fetchesAfterFirstResponse).toBe(0);
    expect(written).toEqual([]);
    expect(fetchServer).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(QUERY_KEY)).toBe('server');
    unsubscribe();
  });
});
