import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { err, ok } from '@src/core/errors/result';
import {
  createEntitlementSnapshot,
  createLimitApiError,
} from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { i18n } from '@src/shared/i18n';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';

import {
  createNudgeInteraction,
  createNudgeInteractionDto,
} from '../__tests__/nudge-interaction.fixtures';
import { createNudgeApiError } from '../__tests__/todo-nudge.fixtures';
import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';
import {
  useReplyToNudgeMutationOptions,
  useSendTodoNudgeMutationOptions,
} from './todo-nudge.mutations';

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
      err(createNudgeApiError({ code: ErrorCode.NUDGE_1105, status: 404 })),
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

describe('useSendTodoNudgeMutationOptions', () => {
  it('콕 한도에 막히면 한도 시트와 햅틱 한 번만 보이고 전역 토스트를 더하지 않는다', async () => {
    // Given
    const limitError = createLimitApiError(ErrorCode.NUDGE_1101);
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(err(limitError));
    const haptics = createHapticsGatewayStub();
    const errorReporter = createErrorReporterStub();
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
    const { result } = await renderScreenHook(
      () => useMutation(useSendTodoNudgeMutationOptions()),
      {
        di: createTestDi({ ports: { httpClient, haptics, errorReporter, queryClient } }),
        withOverlay: true,
        withLocalDate: true,
      },
    );

    // When
    await act(async () => {
      result.current.mutate({ receiverId: 'friend-1', todoId: 1 });
    });

    // Then
    expect(await screen.findByText(i18n.t('subscription:gate.nudgeTitle'))).toBeTruthy();
    expect(screen.queryByText(limitError.message)).toBeNull();
    expect(screen.queryByText(i18n.t('todo:toast.retryLater'))).toBeNull();
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('error');
    expect(errorReporter.captureException).not.toHaveBeenCalled();
  });
});
