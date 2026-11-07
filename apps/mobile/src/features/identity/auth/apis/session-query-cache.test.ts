import { createPendingResponse, createTestQueryClient } from '@src/shared/__tests__';

import { createSessionQueryCache } from './session-query-cache';

describe('createSessionQueryCache', () => {
  it('진행 중 mutation의 콜백을 비워 끝나도 캐시를 쓰지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const pending = createPendingResponse('저장됨');
    const onSuccess = jest.fn();
    const onSettled = jest.fn();
    const running = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => pending.response,
        onSuccess,
        onSettled,
      })
      .execute(undefined);
    await Promise.resolve();

    // When
    createSessionQueryCache(queryClient).abandonPendingMutations();
    pending.settle();
    await running;

    // Then
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('요청 자체는 끊지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const pending = createPendingResponse('저장됨');
    const running = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => pending.response })
      .execute(undefined);
    await Promise.resolve();

    // When
    createSessionQueryCache(queryClient).abandonPendingMutations();
    pending.settle();

    // Then
    await expect(running).resolves.toBe('저장됨');
  });

  it('조회 캐시만 비우면 mutation 기록은 남는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['user', 'me'], { id: 'a' });
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async () => '저장됨' })
      .execute(undefined);

    // When
    createSessionQueryCache(queryClient).clearQueries();

    // Then
    expect(queryClient.getQueryData(['user', 'me'])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
  });
});
