import '@src/shared/i18n/init';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { MEMO_QUERY_KEYS } from '@src/features/notes/memo/constants/memo-query-keys';
import {
  createMemorySyncStorage,
  createMockAnalytics,
  createMockHttpClient,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { Button } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { VoiceService } from '../apis/voice.service';
import type { PlannedAction } from '../domains/voice-plan.model';
import { useApplyActionPlanMutationOptions } from './use-apply-action-plan-mutation-options';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const TODO_ACTION: PlannedAction = {
  type: 'create-todo',
  actionId: 'todo-1',
  title: '운동',
  startDate: '2026-11-05',
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
};

function ApplyProbe({ sourceMemoId }: { sourceMemoId: number | null }) {
  const mutation = useMutation(useApplyActionPlanMutationOptions());

  return (
    <Button
      onPress={() =>
        mutation.mutate({
          source: sourceMemoId == null ? 'quick-voice' : 'memo',
          sourceMemoId,
          actions: [TODO_ACTION],
          fallbackCategoryId: 1,
          skippedCount: 0,
          idempotencyKey: 'key-1',
        })
      }
    >
      저장
    </Button>
  );
}

async function renderApply(sourceMemoId: number | null) {
  const analytics = createMockAnalytics();
  const httpClient = createMockHttpClient();
  httpClient.post.mockResolvedValue(ok({ todos: [], memo: null }));
  const queryClient = createTestQueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

  await renderUi(<ApplyProbe sourceMemoId={sourceMemoId} />, {
    di: {
      analytics,
      voiceService: new VoiceService(httpClient, silentLogger),
      activationService: new ActivationService(
        createActivationProgressRepository(createMemorySyncStorage()),
      ),
    },
    queryClient,
  });
  await fireEvent.press(screen.getByText('저장'));

  return { analytics, httpClient, invalidate };
}

describe('useApplyActionPlanMutationOptions', () => {
  test('메모 계획은 원본 메모를 함께 보내고 메모 목록·한도를 다시 읽으며 예전 전환 이벤트도 보낸다', async () => {
    // Given & When
    const { analytics, httpClient, invalidate } = await renderApply(42);

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'memo_converted_to_todos',
        expect.objectContaining({ memo_id: 42, source: 'ai' }),
      ),
    );
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/action-plans/apply',
      expect.objectContaining({ source: 'MEMO', sourceMemoId: 42 }),
      expect.anything(),
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      'voice_plan_applied',
      expect.objectContaining({ source: 'memo' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MEMO_QUERY_KEYS.list() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MEMO_QUERY_KEYS.resourceLimit() });
  });

  test('메모가 아닌 계획은 원본 메모를 보내지 않고 전환 이벤트도 보내지 않는다', async () => {
    // Given & When
    const { analytics, httpClient } = await renderApply(null);

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_plan_applied',
        expect.objectContaining({ source: 'quick_voice' }),
      ),
    );
    expect(httpClient.post.mock.calls[0]?.[1]).not.toHaveProperty('sourceMemoId');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'memo_converted_to_todos',
      expect.anything(),
    );
  });
});
