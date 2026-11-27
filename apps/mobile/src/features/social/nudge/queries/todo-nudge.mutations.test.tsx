import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createHttpClientStub, createTestQueryClient, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

import {
  createNudgeInteraction,
  createNudgeInteractionDto,
} from '../__tests__/nudge-interaction.fixtures';
import { createNudgeApiError } from '../__tests__/todo-nudge.fixtures';
import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';
import { useReplyToNudgeMutationOptions } from './todo-nudge.mutations';

const NUDGE_ID = 1;

function seedInteractions() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId: NUDGE_ID }),
    createNudgeInteraction({ id: NUDGE_ID }),
  );
  queryClient.setQueryData(TODO_NUDGE_QUERY_KEYS.interactionAvailability(), true);
  queryClient.setQueryData(TODO_NUDGE_QUERY_KEYS.interactionList({ direction: 'received' }), {
    pages: [],
    pageParams: [],
  });
  return queryClient;
}

function isInvalidated(
  queryClient: ReturnType<typeof createTestQueryClient>,
  queryKey: readonly unknown[],
) {
  return queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
}

describe('useReplyToNudgeMutationOptions', () => {
  it('답장하면 응답을 상세에 쓰고 상세는 다시 받지 않으며 목록·답장 가능 여부만 다시 받는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue(ok(createNudgeInteractionDto({ replyKind: 'STARTING' })));
    const queryClient = seedInteractions();
    const { result } = await renderScreenHook(() => useMutation(useReplyToNudgeMutationOptions()), {
      di: createTestDi({ ports: { httpClient, queryClient } }),
    });

    // When
    await act(async () => {
      await result.current.mutateAsync({ nudgeId: NUDGE_ID, input: { replyKind: 'STARTING' } });
    });

    // Then
    const detailKey = TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId: NUDGE_ID });
    expect(queryClient.getQueryData(detailKey)?.replyKind).toBe('STARTING');
    expect(isInvalidated(queryClient, detailKey)).toBe(false);
    expect(
      isInvalidated(queryClient, TODO_NUDGE_QUERY_KEYS.interactionList({ direction: 'received' })),
    ).toBe(true);
    expect(isInvalidated(queryClient, TODO_NUDGE_QUERY_KEYS.interactionAvailability())).toBe(true);
  });

  it('답장이 실패하면 상세도 서버 값으로 다시 받는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.put.mockResolvedValue(
      fail(createNudgeApiError({ code: ErrorCode.NUDGE_1105, status: 404 })),
    );
    const queryClient = seedInteractions();
    const { result } = await renderScreenHook(() => useMutation(useReplyToNudgeMutationOptions()), {
      di: createTestDi({ ports: { httpClient, queryClient } }),
    });

    // When
    await act(async () => {
      await result.current
        .mutateAsync({ nudgeId: NUDGE_ID, input: { replyKind: 'STARTING' } })
        .catch(noop);
    });

    // Then
    expect(
      isInvalidated(queryClient, TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId: NUDGE_ID })),
    ).toBe(true);
  });
});
