import { ok } from '@src/core/errors/result';
import { NetworkError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createHapticsGatewayStub,
  createHttpClientStub,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { createNudgeInteractionDto } from '../__tests__/nudge-interaction.fixtures';
import {
  useReplyToNudgeMutationOptions,
  useSendNudgeThanksMutationOptions,
} from './todo-nudge.mutations';

function useReplyMutation() {
  return useMutation(useReplyToNudgeMutationOptions());
}

function useThanksMutation() {
  return useMutation(useSendNudgeThanksMutationOptions());
}

async function setup() {
  const httpClient = createHttpClientStub();
  const analytics = createAnalyticsStub();
  let reply: ReturnType<typeof useReplyMutation> | undefined;
  let thanks: ReturnType<typeof useThanksMutation> | undefined;
  function Capture({
    onRender,
  }: {
    onRender: (
      replyMutation: ReturnType<typeof useReplyMutation>,
      thanksMutation: ReturnType<typeof useThanksMutation>,
    ) => void;
  }) {
    onRender(useReplyMutation(), useThanksMutation());
    return null;
  }
  const capture = (
    replyMutation: ReturnType<typeof useReplyMutation>,
    thanksMutation: ReturnType<typeof useThanksMutation>,
  ) => {
    reply = replyMutation;
    thanks = thanksMutation;
  };
  await renderScreen(<Capture onRender={capture} />, {
    withOverlay: true,
    di: { httpClient, analytics, haptics: createHapticsGatewayStub() },
  });
  if (reply == null || thanks == null) {
    throw new Error('mutation을 받지 못했다');
  }
  const replyMutation = reply;
  const thanksMutation = thanks;

  return {
    httpClient,
    analytics,
    replyToNudge: (variables: Parameters<typeof replyMutation.mutateAsync>[0]) =>
      act(() => replyMutation.mutateAsync(variables).catch(() => undefined)),
    sendThanks: (variables: Parameters<typeof thanksMutation.mutateAsync>[0]) =>
      act(() => thanksMutation.mutateAsync(variables).catch(() => undefined)),
  };
}

describe('콕 답장·감사 Analytics', () => {
  it('답장 성공 시 공용 카탈로그의 답장 종류만 기록한다', async () => {
    // Given
    const { httpClient, analytics, replyToNudge } = await setup();
    httpClient.put.mockResolvedValue(ok(createNudgeInteractionDto({ replyKind: 'STARTING' })));

    // When
    await replyToNudge({ nudgeId: 1, input: { replyKind: 'STARTING' } });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('nudge_replied', { reply_kind: 'STARTING' });
  });

  it('감사 성공 시 서버가 실제 전송한 친구 수를 기록한다', async () => {
    // Given
    const { httpClient, analytics, sendThanks } = await setup();
    httpClient.put.mockResolvedValue(ok({ sentCount: 22 }));

    // When
    await sendThanks({ todoId: 1, input: { throughNudgeId: 22 } });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('nudge_thanks_sent', { recipient_count: 22 });
  });

  it('이미 감사한 친구에게 재요청하면 전송 성공 이벤트를 늘리지 않는다', async () => {
    // Given
    const { httpClient, analytics, sendThanks } = await setup();
    httpClient.put.mockResolvedValue(ok({ sentCount: 0 }));

    // When
    await sendThanks({ todoId: 1, input: { throughNudgeId: 22 } });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('답장·감사 요청이 실패하면 성공 이벤트를 기록하지 않는다', async () => {
    // Given
    const { httpClient, analytics, replyToNudge, sendThanks } = await setup();
    httpClient.put.mockRejectedValue(new NetworkError());

    // When
    await replyToNudge({ nudgeId: 1, input: { replyKind: 'LATER' } });
    await sendThanks({ todoId: 1, input: { throughNudgeId: 22 } });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
