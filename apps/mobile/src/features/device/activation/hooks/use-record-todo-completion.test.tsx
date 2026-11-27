import { emitTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import {
  createAnalyticsStub,
  createTestDi,
  getTrackedEvents,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { useRecordTodoCompletion } from './use-record-todo-completion';

/** 2026-01-01 09:00(UTC)에 가입한 계정의 사흘째 */
const NOW = new Date('2026-01-03T12:00:00.000Z');
const USER = createUser();

async function renderRecorder({ hasCreatedTodo }: { hasCreatedTodo: boolean }) {
  const analytics = createAnalyticsStub();
  const di = createTestDi({ ports: { analytics } });
  di.queryClient.setQueryData(USER_QUERY_KEYS.me(), USER);
  if (hasCreatedTodo) {
    di.activationService.recordTodoCreated({
      user: USER,
      now: toInstant('2026-01-02T10:00:00.000Z'),
    });
  }
  await renderScreenHook(useRecordTodoCompletion, { di });

  return { analytics };
}

describe('useRecordTodoCompletion', () => {
  setupFakeTimersPerTest({ now: NOW });

  it('가입 첫 주에 만든 할 일을 처음 끝내면 활성화를 가입 뒤 날 수와 함께 한 번 남긴다', async () => {
    // Given
    const { analytics } = await renderRecorder({ hasCreatedTodo: true });

    // When
    await act(async () => emitTodoCompletionChanged({ isCompleted: true }));
    await act(async () => emitTodoCompletionChanged({ isCompleted: true }));

    // Then
    expect(getTrackedEvents(analytics, 'activation_completed')).toEqual([{ days_since_signup: 2 }]);
  });

  it('할 일을 만든 적이 없거나 완료를 푼 것이면 남기지 않는다', async () => {
    // Given
    const { analytics } = await renderRecorder({ hasCreatedTodo: false });

    // When
    await act(async () => emitTodoCompletionChanged({ isCompleted: true }));
    await act(async () => emitTodoCompletionChanged({ isCompleted: false }));

    // Then
    expect(getTrackedEvents(analytics, 'activation_completed')).toEqual([]);
  });
});
