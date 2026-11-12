import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createStoreReviewRepository } from '@src/features/device/store-review/repositories/store-review.repository';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import '@src/shared/i18n/init';
import type { DateKey } from '@src/shared/date/date-key';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import {
  createAppStoreReviewGatewayStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoApiError, createTodoDto } from '../__tests__/todo.fixtures';
import type { Todo, TodoListResult } from '../domains/todo.model';
import { TODO_QUERY_KEYS } from './todo-query-keys';
import {
  useToggleTodoMutationOptions,
  useUpdateTodoScheduleMutationOptions,
} from './todo.mutations';

const TODAY = createDateKey('2026-10-27');
const YESTERDAY = createDateKey('2026-10-26');
const DEVICE_CALENDAR = { timeZone: 'Asia/Seoul' };
const ACCOUNT_ID = 'account-1';
/** 리뷰 요청은 이 두 날에 오늘이 더해져 3일을 채워야 열린다 */
const PAST_ACTIVE_DAYS = [createDateKey('2026-10-24'), createDateKey('2026-10-25')];
/** 축하 화면이 가라앉기를 기다리는 시간(1.2초)보다 길게 */
const REVIEW_SETTLE_MS = 2_000;

setupFakeTimersPerTest({ now: new Date('2026-10-27T03:00:00.000Z'), doNotFake: ['nextTick'] });

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

async function renderToggle() {
  const httpClient = createHttpClientStub();
  const syncStorage = createMemoryObservableSyncStorage();
  const appStoreReview = createAppStoreReviewGatewayStub();
  const storeReviewRepository = createStoreReviewRepository(syncStorage);
  storeReviewRepository.update(ACCOUNT_ID, (state) => ({ ...state, activeDays: PAST_ACTIVE_DAYS }));
  const current: { value: ReturnType<typeof useToggle> | null } = { value: null };

  function useToggle() {
    return useMutation(useToggleTodoMutationOptions());
  }

  function Probe() {
    current.value = useToggle();
    return null;
  }

  const { queryClient } = await renderScreen(
    <LocalDateProvider useDeviceCalendar={() => DEVICE_CALENDAR}>
      <Probe />
    </LocalDateProvider>,
    { di: createTestDi({ ports: { httpClient, syncStorage, appStoreReview } }) },
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));

  const toggle = async (todoId: number, completed: boolean, date: DateKey) => {
    if (current.value == null) {
      throw new Error('Probe가 렌더되지 않았다');
    }
    const toggled = current.value;
    await act(async () => {
      await toggled.mutateAsync({ todoId, body: { completed }, date }).catch(() => undefined);
    });
  };
  const startToggle = async (todoId: number, completed: boolean, date: DateKey) => {
    if (current.value == null) {
      throw new Error('Probe가 렌더되지 않았다');
    }
    const toggled = current.value;
    await act(async () => {
      toggled.mutate({ todoId, body: { completed }, date });
    });
  };
  const givenList = (date: DateKey, todos: Todo[]) =>
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date }), toList(todos));
  // 관찰자가 없는 조회라 무효화돼도 다시 받지 않고 무효 표시만 남는다
  const givenCached = (queryKey: readonly unknown[]) =>
    queryClient.getQueryCache().build(queryClient, { queryKey });
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated === true;

  return {
    httpClient,
    queryClient,
    appStoreReview,
    getActiveDays: () => storeReviewRepository.find(ACCOUNT_ID)?.activeDays,
    settleReviewWait: () => act(async () => jest.advanceTimersByTimeAsync(REVIEW_SETTLE_MS)),
    toggle,
    startToggle,
    givenList,
    givenCached,
    isInvalidated,
  };
}

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const respondWithTodo = (id: number) => ok({ message: 'ok', todo: createTodoDto({ id }) });

describe('useToggleTodoMutationOptions store review wiring', () => {
  it('오늘의 마지막 할 일을 끝낸 순간 끝낸 날을 남기고 리뷰 순간을 알린다', async () => {
    // Given
    const { httpClient, givenList, toggle, settleReviewWait, getActiveDays, appStoreReview } =
      await renderToggle();
    givenList(TODAY, [
      createParentTodo({ id: 41, completed: true }),
      createParentTodo({ id: 42, completed: false }),
    ]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, TODAY);
    await settleReviewWait();

    // Then
    expect(getActiveDays()).toContain(TODAY);
    expect(appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('어제 목록에서 여러 날 할 일을 끝내 오늘 할 일이 모두 끝나면 리뷰 순간을 알린다', async () => {
    // Given
    // 낙관적 갱신은 보고 있는 어제 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const { httpClient, givenList, toggle, settleReviewWait, appStoreReview } =
      await renderToggle();
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
    await settleReviewWait();

    // Then
    expect(appStoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('오늘 남은 할 일이 있으면 어제 목록의 여러 날 할 일을 끝내도 리뷰 순간을 알리지 않는다', async () => {
    // Given
    const { httpClient, givenList, toggle, settleReviewWait, getActiveDays, appStoreReview } =
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
    await settleReviewWait();

    // Then
    expect(getActiveDays()).toContain(TODAY);
    expect(appStoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('미완료로 되돌리거나 요청이 실패하면 아무것도 남기지 않는다', async () => {
    // Given
    const { httpClient, givenList, toggle, settleReviewWait, getActiveDays, appStoreReview } =
      await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, completed: true })]);
    httpClient.patch.mockResolvedValueOnce(respondWithTodo(42));

    // When
    await toggle(42, false, TODAY);
    httpClient.patch.mockResolvedValueOnce(err(createTodoApiError()));
    await toggle(42, true, TODAY);
    await settleReviewWait();

    // Then
    expect(getActiveDays()).toEqual(PAST_ACTIVE_DAYS);
    expect(appStoreReview.requestReview).not.toHaveBeenCalled();
  });
});

describe('useToggleTodoMutationOptions settle', () => {
  it('다른 체크가 아직 진행 중이면 완료 기록을 다시 부르지 않아 낙관적 값이 깜빡이지 않는다', async () => {
    // Given
    const { httpClient, givenList, givenCached, toggle, startToggle, isInvalidated } =
      await renderToggle();
    givenList(TODAY, [
      createParentTodo({ id: 41, completed: false }),
      createParentTodo({ id: 42, completed: false }),
    ]);
    givenCached(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY }));
    const first = createPendingResponse(respondWithTodo(42));
    httpClient.patch.mockReturnValueOnce(first.response).mockResolvedValueOnce(respondWithTodo(41));

    // When
    await startToggle(42, true, TODAY);
    await toggle(41, true, TODAY);

    // Then
    expect(
      isInvalidated(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY })),
    ).toBe(false);
    await act(async () => first.settle());
  });

  it('하루짜리 체크가 확정되면 목록·달력은 다시 받지 않고 서버만 아는 위젯 요약만 맞춘다', async () => {
    // Given
    const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
    givenCached(TODO_QUERY_KEYS.widgetSummaryByDate({ date: TODAY, userId: ACCOUNT_ID }));
    givenCached(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY }));
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(
      isInvalidated(TODO_QUERY_KEYS.widgetSummaryByDate({ date: TODAY, userId: ACCOUNT_ID })),
    ).toBe(true);
    expect(isInvalidated(TODO_QUERY_KEYS.listByDate({ date: TODAY }))).toBe(false);
    expect(
      isInvalidated(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY })),
    ).toBe(false);
  });

  it('체크가 실패하면 그 목록과 달력을 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
    givenCached(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY }));
    httpClient.patch.mockResolvedValue(err(createTodoApiError()));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(isInvalidated(TODO_QUERY_KEYS.listByDate({ date: TODAY }))).toBe(true);
    expect(
      isInvalidated(TODO_QUERY_KEYS.completionsByRange({ startDate: TODAY, endDate: TODAY })),
    ).toBe(true);
  });

  it('지난 날짜를 체크하면 그 해의 주간 달성 목록을 다시 부른다', async () => {
    // Given
    const { httpClient, givenList, givenCached, toggle, isInvalidated } = await renderToggle();
    givenList(YESTERDAY, [createParentTodo({ id: 42, completed: false })]);
    givenCached(['achievement', 'weekly-list', { year: 2026 }]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, YESTERDAY);

    // Then
    expect(isInvalidated(['achievement', 'weekly-list', { year: 2026 }])).toBe(true);
  });
});

describe('useUpdateTodoScheduleMutationOptions 반복 상한', () => {
  it('이후 회차까지 옮기다 반복 상한에 걸리면 서버가 보낸 한도로 안내한다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.patch.mockResolvedValue(
      err(new ApiError('TODO_0842', '서버 문구', 403, { limit: 7, activeCount: 7 })),
    );
    const current: { value: ReturnType<typeof useUpdateSchedule> | null } = { value: null };
    function useUpdateSchedule() {
      return useMutation(useUpdateTodoScheduleMutationOptions());
    }
    function Probe() {
      current.value = useUpdateSchedule();
      return null;
    }
    await renderScreen(<Probe />, { di: createTestDi({ ports: { httpClient } }) });

    // When
    await act(async () => {
      await current.value
        ?.mutateAsync({
          todoId: 1,
          input: { startDate: TODAY },
          scope: 'THIS_AND_FOLLOWING',
        })
        .catch(() => undefined);
    });

    // Then
    expect(await screen.findAllByText('반복 할 일은 최대 7개까지 만들 수 있어요')).not.toHaveLength(
      0,
    );
  });
});
