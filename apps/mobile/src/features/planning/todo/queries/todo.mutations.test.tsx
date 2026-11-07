import { err, ok } from '@src/core/errors/result';
import '@src/shared/i18n/init';
import { createActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import { ActivationService } from '@src/features/device/activation/apis/activation.service';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemorySyncStorage,
  createPendingResponse,
  createTestDi,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { getNowInstant } from '@src/shared/date/instant';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoApiError, createTodoDto } from '../__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { Todo, TodoListResult } from '../schemas/todo.schema';
import { useToggleTodoMutationOptions } from './todo.mutations';

const TODAY = '2026-10-27';
const YESTERDAY = '2026-10-26';
const DEVICE_CALENDAR = { timeZone: 'Asia/Seoul' };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-27T03:00:00.000Z'), doNotFake: ['nextTick'] });
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderToggle() {
  const httpClient = createHttpClientStub();
  const storeReviewService = new StoreReviewService(
    createStoreReviewRepository(createMemorySyncStorage()),
    { isAvailable: async () => false, requestReview: async () => undefined },
    getNowInstant,
  );
  const recordActiveDay = jest.spyOn(storeReviewService, 'recordActiveDay');
  const requestReviewAt = jest.spyOn(storeReviewService, 'requestReviewAt');
  const current: { value: ReturnType<typeof useToggle> | null } = { value: null };

  function useToggle() {
    return useMutation(useToggleTodoMutationOptions());
  }

  function Probe() {
    current.value = useToggle();
    return null;
  }

  const { queryClient } = await renderUi(
    <LocalDateProvider useDeviceCalendar={() => DEVICE_CALENDAR}>
      <Probe />
    </LocalDateProvider>,
    {
      di: createTestDi({
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        activationService: new ActivationService(
          createActivationProgressRepository(createMemorySyncStorage()),
        ),
        storeReviewService,
      }),
    },
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'account-1' });
  const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

  const toggle = async (todoId: number, completed: boolean, date: string) => {
    if (current.value == null) {
      throw new Error('Probe가 렌더되지 않았다');
    }
    const toggled = current.value;
    await act(async () => {
      await toggled.mutateAsync({ todoId, body: { completed }, date }).catch(() => undefined);
    });
  };
  const startToggle = async (todoId: number, completed: boolean, date: string) => {
    if (current.value == null) {
      throw new Error('Probe가 렌더되지 않았다');
    }
    const toggled = current.value;
    await act(async () => {
      toggled.mutate({ todoId, body: { completed }, date });
    });
  };
  const givenList = (date: string, todos: Todo[]) =>
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date }), toList(todos));
  const invalidatedKeys = () => invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey);

  return {
    httpClient,
    queryClient,
    recordActiveDay,
    requestReviewAt,
    toggle,
    startToggle,
    givenList,
    invalidatedKeys,
    clearCalls: () => {
      recordActiveDay.mockClear();
      requestReviewAt.mockClear();
      invalidateQueries.mockClear();
    },
  };
}

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const respondWithTodo = (id: number) => ok({ message: 'ok', todo: createTodoDto({ id }) });

describe('useToggleTodoMutationOptions store review wiring', () => {
  it('오늘의 마지막 할 일을 끝낸 순간 끝낸 날을 남기고 리뷰 순간을 알린다', async () => {
    // Given
    const { httpClient, givenList, toggle, recordActiveDay, requestReviewAt } =
      await renderToggle();
    givenList(TODAY, [
      createParentTodo({ id: 41, completed: true }),
      createParentTodo({ id: 42, completed: false }),
    ]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(recordActiveDay).toHaveBeenCalledWith('account-1', TODAY);
    expect(requestReviewAt).toHaveBeenCalledWith(
      { accountId: 'account-1', moment: 'all_todos_done' },
      expect.any(Function),
    );
  });

  it('어제 목록에서 여러 날 할 일을 끝내 오늘 할 일이 모두 끝나면 리뷰 순간을 알린다', async () => {
    // Given 낙관적 갱신은 보고 있는 어제 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const { httpClient, givenList, toggle, requestReviewAt } = await renderToggle();
    const multiDay = createParentTodo({
      id: 7,
      startDate: YESTERDAY,
      endDate: TODAY,
      completed: false,
    });
    givenList(YESTERDAY, [multiDay]);
    givenList(TODAY, [createParentTodo({ id: 41, completed: true }), multiDay]);
    httpClient.patch.mockResolvedValue(respondWithTodo(7));

    // When
    await toggle(7, true, YESTERDAY);

    // Then
    expect(requestReviewAt).toHaveBeenCalledTimes(1);
  });

  it('오늘 남은 할 일이 있으면 어제 목록의 여러 날 할 일을 끝내도 리뷰 순간을 알리지 않는다', async () => {
    // Given
    const { httpClient, givenList, toggle, recordActiveDay, requestReviewAt } =
      await renderToggle();
    const multiDay = createParentTodo({
      id: 7,
      startDate: YESTERDAY,
      endDate: TODAY,
      completed: false,
    });
    givenList(YESTERDAY, [multiDay]);
    givenList(TODAY, [createParentTodo({ id: 41, completed: false }), multiDay]);
    httpClient.patch.mockResolvedValue(respondWithTodo(7));

    // When
    await toggle(7, true, YESTERDAY);

    // Then
    expect(recordActiveDay).toHaveBeenCalledTimes(1);
    expect(requestReviewAt).not.toHaveBeenCalled();
  });

  it('미완료로 되돌리거나 요청이 실패하면 아무것도 남기지 않는다', async () => {
    // Given
    const { httpClient, givenList, toggle, recordActiveDay, requestReviewAt } =
      await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, completed: true })]);
    httpClient.patch.mockResolvedValueOnce(respondWithTodo(42));

    // When
    await toggle(42, false, TODAY);
    httpClient.patch.mockResolvedValueOnce(err(createTodoApiError()));
    await toggle(42, true, TODAY);

    // Then
    expect(recordActiveDay).not.toHaveBeenCalled();
    expect(requestReviewAt).not.toHaveBeenCalled();
  });
});

describe('useToggleTodoMutationOptions settle', () => {
  it('다른 체크가 아직 진행 중이면 완료 기록을 다시 부르지 않아 낙관적 값이 깜빡이지 않는다', async () => {
    // Given
    const { httpClient, givenList, toggle, startToggle, invalidatedKeys } = await renderToggle();
    givenList(TODAY, [
      createParentTodo({ id: 41, completed: false }),
      createParentTodo({ id: 42, completed: false }),
    ]);
    const first = createPendingResponse(respondWithTodo(42));
    httpClient.patch.mockReturnValueOnce(first.response).mockResolvedValueOnce(respondWithTodo(41));

    // When
    await startToggle(42, true, TODAY);
    await toggle(41, true, TODAY);

    // Then
    expect(invalidatedKeys()).not.toContainEqual(TODO_QUERY_KEYS.completions());
    await act(async () => first.settle());
  });

  it('마지막 체크가 끝나면 목록과 완료 기록을 다시 부른다', async () => {
    // Given
    const { httpClient, givenList, toggle, invalidatedKeys } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, completed: false })]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([TODO_QUERY_KEYS.lists(), TODO_QUERY_KEYS.completions()]),
    );
  });

  it('지난 날짜를 체크하면 그 해의 주간 달성 목록을 다시 부른다', async () => {
    // Given
    const { httpClient, givenList, toggle, invalidatedKeys } = await renderToggle();
    givenList(YESTERDAY, [createParentTodo({ id: 42, completed: false })]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, YESTERDAY);

    // Then
    expect(invalidatedKeys()).toContainEqual(['achievement', 'weekly-list', { year: 2026 }]);
  });
});
