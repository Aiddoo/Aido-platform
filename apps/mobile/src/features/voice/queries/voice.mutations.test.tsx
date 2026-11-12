import { ApiError } from '@src/core/errors/api-error';
import '@src/shared/i18n/init';
import { err, ok, type Result } from '@src/core/errors/result';
import { Button } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { PlannedAction } from '../domains/voice-plan.model';
import { useApplyActionPlanMutationOptions } from './voice.mutations';

const TODO_ACTION: PlannedAction = {
  type: 'create-todo',
  actionId: 'todo-1',
  title: '운동',
  startDate: createDateKey('2026-11-05'),
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
  categoryId: 1,
  duplicateOfTodoId: null,
};

function ApplyProbe({
  sourceMemoId,
  onMemoChanged,
}: {
  sourceMemoId: number | null;
  onMemoChanged: () => void;
}) {
  const mutation = useMutation(useApplyActionPlanMutationOptions({ onMemoChanged }));

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

async function renderApply(
  sourceMemoId: number | null,
  response: Result<unknown, ApiError> = ok({ todos: [], memo: null }),
) {
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.post.mockResolvedValue(response);
  const queryClient = createTestQueryClient();
  const onMemoChanged = jest.fn();

  await renderScreen(<ApplyProbe sourceMemoId={sourceMemoId} onMemoChanged={onMemoChanged} />, {
    di: createTestDi({ ports: { httpClient, analytics, queryClient } }),
  });
  await fireEvent.press(screen.getByText('저장'));

  return { analytics, httpClient, onMemoChanged };
}

describe('useApplyActionPlanMutationOptions', () => {
  it('메모 계획은 원본 메모를 함께 보내고 메모가 바뀌었다고 알리며 예전 전환 이벤트도 보낸다', async () => {
    // When
    const { analytics, httpClient, onMemoChanged } = await renderApply(42);

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
    expect(onMemoChanged).toHaveBeenCalledTimes(1);
  });

  it('메모가 아닌 계획은 원본 메모를 보내지 않고 전환 이벤트도 보내지 않는다', async () => {
    // When
    const { analytics, httpClient, onMemoChanged } = await renderApply(null);

    // Then
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'voice_plan_applied',
        expect.objectContaining({ source: 'quick_voice' }),
      ),
    );
    expect(httpClient.post.mock.calls[0]?.[1]).not.toHaveProperty('sourceMemoId');
    expect(onMemoChanged).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'memo_converted_to_todos',
      expect.anything(),
    );
  });

  it('원본 메모가 이미 없어 저장하지 못하면 메모가 바뀌었다고 알려 목록을 다시 읽게 한다', async () => {
    // When
    const { onMemoChanged } = await renderApply(
      42,
      err(new ApiError('MEMO_2001', '메모 없음', 404)),
    );

    // Then
    await waitFor(() => expect(onMemoChanged).toHaveBeenCalledTimes(1));
  });
});
