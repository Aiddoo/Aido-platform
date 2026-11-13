import { createPendingResponse, createTestQueryClient } from '@src/testing/core';

import { isLastMutation } from './is-last-mutation';

const WRITES_KEY = ['memo', 'mutation', 'write'] as const;

describe('isLastMutation', () => {
  it('같은 키의 앞 변경이 끝날 때는 false, 마지막 변경이 끝날 때만 true다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    const settledAsLast: boolean[] = [];
    const first = createPendingResponse(undefined);
    const second = createPendingResponse(undefined);
    const run = (response: Promise<undefined>) =>
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationKey: WRITES_KEY,
          mutationFn: () => response,
          onSettled: () => {
            settledAsLast.push(isLastMutation(queryClient, WRITES_KEY));
          },
        })
        .execute(undefined);
    const firstWrite = run(first.response);
    const secondWrite = run(second.response);

    // When
    first.settle();
    await firstWrite;
    second.settle();
    await secondWrite;

    // Then
    expect(settledAsLast).toEqual([false, true]);
  });
});
