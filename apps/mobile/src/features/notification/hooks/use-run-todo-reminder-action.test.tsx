import { ErrorCode } from '@aido/api/errors';
import { fail, ok } from '@src/core/errors/result';
import { createTodoDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import {
  createAnalyticsStub,
  createApiError,
  createHttpClientStub,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, screen } from '@testing-library/react-native';

import { useRunTodoReminderAction } from './use-run-todo-reminder-action';

const SNOOZE_PATH = 'v1/todo-reminders/42/snoozes';
const DETAILS_PATH = 'v1/todos/42/details';

describe('useRunTodoReminderAction', () => {
  it('다시 알림을 기다리는 사이 로그아웃하면 다음 계정 화면에 안내와 결과 기록을 남기지 않는다', async () => {
    // Given
    const snooze = createPendingResponse(fail(createApiError(ErrorCode.NOTIFICATION_1007)));
    const httpClient = createHttpClientStub();
    httpClient.post.mockImplementation((path) =>
      path === SNOOZE_PATH ? snooze.response : new Promise(() => undefined),
    );
    const analytics = createAnalyticsStub();
    const di = createTestDi({ ports: { httpClient, analytics } });
    const { result } = await renderScreenHook(() => useRunTodoReminderAction(), {
      di,
      withLocalDate: true,
    });
    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = result.current({ type: 'snooze', todoId: 42, notificationId: 7 });
    });

    // When
    di.sessionEpoch.advance();
    await act(async () => {
      snooze.settle();
      await running;
    });

    // Then
    expect(httpClient.post).toHaveBeenCalledWith(SNOOZE_PATH, { notificationId: 7 });
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'todo_reminder_action_tapped',
      expect.anything(),
    );
    expect(screen.queryByText('이미 완료한 할 일이에요')).toBeNull();
  });

  it('완료할 할 일의 상세를 기다리는 사이 로그아웃하면 완료 요청을 보내지 않는다', async () => {
    // Given
    const details = createPendingResponse(
      ok({
        todo: createTodoDto({ id: 42, title: '저녁 운동', completed: false }),
        owner: { id: 'clz7x5p8k0010qz0z8z8z8z8z', name: '나', profileImage: null },
        permissions: { canEdit: true, canComment: true, canNudge: false, canThank: false },
        metrics: { viewCount: 0, commentCount: 0 },
      }),
    );
    const httpClient = createHttpClientStub();
    httpClient.get.mockImplementation((path) =>
      path === DETAILS_PATH ? details.response : new Promise(() => undefined),
    );
    httpClient.patch.mockResolvedValue(fail(createApiError(ErrorCode.TODO_0801)));
    const analytics = createAnalyticsStub();
    const di = createTestDi({ ports: { httpClient, analytics } });
    const { result } = await renderScreenHook(() => useRunTodoReminderAction(), {
      di,
      withLocalDate: true,
    });
    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = result.current({ type: 'complete', todoId: 42, dateKey: null });
    });

    // When
    di.sessionEpoch.advance();
    await act(async () => {
      details.settle();
      await running;
    });

    // Then
    expect(httpClient.get).toHaveBeenCalledWith(DETAILS_PATH, expect.anything());
    expect(httpClient.patch).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'todo_reminder_action_tapped',
      expect.anything(),
    );
  });
});
