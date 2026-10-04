import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { createNudgeInteractionDto } from '../../__tests__/nudge-interaction.factories';
import { toNudgeInteraction } from '../../services/nudge-interaction.mapper';
import { useReplyToNudgeMutationOptions } from './use-reply-to-nudge-mutation-options';
import { useSendNudgeThanksMutationOptions } from './use-send-nudge-thanks-mutation-options';

const mockTrackEvent = jest.fn();
const mockCaptureException = jest.fn();
let mockQueryClient: QueryClient;

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useTodoNudgeService: () => ({ replyToNudge: jest.fn(), sendThanks: jest.fn() }),
  useErrorReporter: () => ({ captureException: mockCaptureException }),
}));

jest.mock('@src/shared/analytics', () => ({
  useTrack: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => mockQueryClient,
}));

describe('콕 답장·감사 Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryClient = new QueryClient();
  });

  afterEach(() => {
    mockQueryClient.clear();
  });

  it('답장 성공 시 공용 카탈로그의 답장 종류만 기록한다', async () => {
    // Given
    const { result } = await renderHook(() => useReplyToNudgeMutationOptions());
    const nudge = toNudgeInteraction(createNudgeInteractionDto({ replyKind: 'STARTING' }));

    // When
    await result.current.onSuccess?.(
      nudge,
      { nudgeId: nudge.id, input: { replyKind: 'STARTING' } },
      undefined,
      { client: mockQueryClient, meta: undefined, mutationKey: undefined },
    );

    // Then
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('nudge_replied', { reply_kind: 'STARTING' });
  });

  it('감사 성공 시 서버가 실제 전송한 친구 수를 기록한다', async () => {
    // Given
    const { result } = await renderHook(() => useSendNudgeThanksMutationOptions());

    // When
    await result.current.onSuccess?.(22, { todoId: 1, input: { throughNudgeId: 22 } }, undefined, {
      client: mockQueryClient,
      meta: undefined,
      mutationKey: undefined,
    });

    // Then
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('nudge_thanks_sent', { recipient_count: 22 });
  });

  it('이미 감사한 친구에게 재요청하면 전송 성공 이벤트를 늘리지 않는다', async () => {
    // Given
    const { result } = await renderHook(() => useSendNudgeThanksMutationOptions());

    // When
    await result.current.onSuccess?.(0, { todoId: 1, input: { throughNudgeId: 22 } }, undefined, {
      client: mockQueryClient,
      meta: undefined,
      mutationKey: undefined,
    });

    // Then
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('답장·감사 요청이 실패하면 성공 이벤트를 기록하지 않는다', async () => {
    // Given
    const reply = await renderHook(() => useReplyToNudgeMutationOptions());
    const thanks = await renderHook(() => useSendNudgeThanksMutationOptions());
    const context = { client: mockQueryClient, meta: undefined, mutationKey: undefined };

    // When
    await reply.result.current.onError?.(
      new Error('network error'),
      { nudgeId: 1, input: { replyKind: 'LATER' } },
      undefined,
      context,
    );
    await thanks.result.current.onError?.(
      new Error('network error'),
      { todoId: 1, input: { throughNudgeId: 22 } },
      undefined,
      context,
    );

    // Then
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
