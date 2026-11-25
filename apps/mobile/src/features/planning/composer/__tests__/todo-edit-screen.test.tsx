import '@src/shared/i18n/init';
import { fail, ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import {
  createTodoApiError,
  createTodoDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { layoutSheetRoute } from '@src/features/planning/todo/__tests__/todo.test-utils';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  createTestQueryClient,
  respondByPath,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import TodoEditSheetRoute from '../../../../../app/(app)/todo/[todoId]/edit';

const TODAY = createDateKey('2026-10-27');
const PLACEHOLDER = '무엇을 하고 싶나요?';
const DAILY_SERIES = {
  recurrenceGroupId: 'series-1',
  repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
} as const;

async function renderEditRoute(todo: Todo) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/auth/preference': ok(createPreferenceDto()),
    }),
  );
  httpClient.patch.mockResolvedValue(ok({ message: 'ok', todo: createTodoDto({ id: todo.id }) }));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date: todo.startDate }), {
    todos: [todo],
    hasNext: false,
    nextCursor: null,
  });
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ todoId: String(todo.id), date: todo.startDate });

  const analytics = createAnalyticsStub();

  await renderScreen(<TodoEditSheetRoute />, {
    withLocalDate: true,
    di: createTestDi({ ports: { httpClient, queryClient, analytics } }),
  });
  await layoutSheetRoute();
  await screen.findByDisplayValue(todo.title);
  await screen.findByRole('button', { name: '기본' });

  return { httpClient, analytics };
}

function countEvents(analytics: ReturnType<typeof createAnalyticsStub>, eventName: string) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length;
}

async function editTitle(title: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), title);
}

async function save() {
  await userEvent.press(screen.getByRole('button', { name: '저장하기' }));
}

describe('TodoEditSheetRoute', () => {
  setupFakeTimersPerTest({ now: new Date(2026, 9, 27, 9), advanceTimers: true });

  it('제목만 고치면 바뀐 제목만 실어 한 번 보낸다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({ id: 5, title: '장보기', startDate: TODAY, isAllDay: true }),
    );
    await editTitle('장보기와 요리');

    // When
    await save();

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/5', { title: '장보기와 요리' });
  });

  it('같은 프레임에 저장을 두 번 눌러도 한 번 보낸다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({ id: 5, title: '장보기', startDate: TODAY, isAllDay: true }),
    );
    await editTitle('장보기와 요리');
    const submit = screen.getByRole('button', { name: '저장하기' });

    // When
    await act(async () => {
      await fireEvent.press(submit);
      await fireEvent.press(submit);
    });
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('반복 할 일에서 같은 프레임에 저장을 두 번 눌러도 범위를 한 번 묻고 한 번 보낸다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({
        id: 5,
        title: '물 마시기',
        startDate: TODAY,
        isAllDay: true,
        ...DAILY_SERIES,
      }),
    );
    await editTitle('물 두 잔 마시기');
    const submit = screen.getByRole('button', { name: '저장하기' });

    // When
    await act(async () => {
      fireEvent.press(submit).catch(() => undefined);
      fireEvent.press(submit).catch(() => undefined);
    });
    const scopeTitles = await screen.findAllByText('반복 할 일 수정');
    await userEvent.press(screen.getByRole('button', { name: '이 할 일과 이후 할 일' }));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(scopeTitles).toHaveLength(1);
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it('아무것도 바꾸지 않고 저장하면 요청을 보내지 않는다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({ id: 5, title: '장보기', startDate: TODAY, isAllDay: true }),
    );

    // When
    await save();
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it('저장이 실패해도 고친 제목이 칸에 남는다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({ id: 5, title: '장보기', startDate: TODAY, isAllDay: true }),
    );
    httpClient.patch.mockResolvedValue(fail(createTodoApiError()));
    await editTitle('장보기와 요리');

    // When
    await save();

    // Then
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledTimes(1));
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('장보기와 요리');
  });

  it('반복 할 일의 제목을 고치면 범위를 묻고, 이후 할 일까지를 고르면 그 범위로 보내고 한 번씩 남긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderEditRoute(
      createParentTodo({
        id: 5,
        title: '물 마시기',
        startDate: TODAY,
        isAllDay: true,
        ...DAILY_SERIES,
      }),
    );
    await editTitle('물 두 잔 마시기');

    // When
    await save();
    await userEvent.press(await screen.findByRole('button', { name: '이 할 일과 이후 할 일' }));

    // Then
    await waitFor(() => expect(countEvents(analytics, 'todo_series_edited')).toBe(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith('v1/todos/5', {
      title: '물 두 잔 마시기',
      scope: 'THIS_AND_FOLLOWING',
    });
    expect(countEvents(analytics, 'todo_edited')).toBe(1);
    expect(countEvents(analytics, 'todo_series_edited')).toBe(1);
  });

  it('반복 할 일의 범위를 묻다 뒤로 가면 보내지 않고 고친 제목이 남는다', async () => {
    // Given
    const { httpClient } = await renderEditRoute(
      createParentTodo({
        id: 5,
        title: '물 마시기',
        startDate: TODAY,
        isAllDay: true,
        ...DAILY_SERIES,
      }),
    );
    await editTitle('물 두 잔 마시기');
    await save();

    // When
    await userEvent.press(await screen.findByRole('button', { name: '뒤로 가기' }));
    await act(() => jest.advanceTimersByTimeAsync(1_000));

    // Then
    expect(httpClient.patch).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveDisplayValue('물 두 잔 마시기');
  });

  it('반복 할 일의 날짜만 옮기면 범위를 묻지 않고 이 할 일만 옮긴다', async () => {
    // Given
    const { httpClient, analytics } = await renderEditRoute(
      createParentTodo({
        id: 5,
        title: '물 마시기',
        startDate: TODAY,
        isAllDay: true,
        ...DAILY_SERIES,
      }),
    );

    // When
    await userEvent.press(await screen.findByRole('button', { name: '오늘' }));
    await userEvent.press(await screen.findByText('내일'));
    await save();

    // Then
    await waitFor(() => expect(countEvents(analytics, 'todo_series_edited')).toBe(1));
    await act(() => jest.advanceTimersByTimeAsync(1_000));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('반복 할 일 수정')).toBeNull();
    expect(httpClient.patch.mock.calls[0]?.[1]).toMatchObject({
      startDate: '2026-10-28',
      scope: 'THIS_ONLY',
    });
    expect(countEvents(analytics, 'todo_series_edited')).toBe(1);
  });
});
