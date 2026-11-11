import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { createStoreReviewRepository } from '@src/features/device/store-review/apis/store-review.repository';
import '@src/shared/i18n/init';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createAppStoreReviewGatewayStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { useMutation } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoApiError, createTodoDto } from '../__tests__/todo.fixtures';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { Todo, TodoListResult } from '../domains/todo.model';
import {
  useToggleTodoMutationOptions,
  useUpdateTodoScheduleMutationOptions,
} from './todo.mutations';

const TODAY = '2026-10-27';
const YESTERDAY = '2026-10-26';
const DEVICE_CALENDAR = { timeZone: 'Asia/Seoul' };
const ACCOUNT_ID = 'account-1';
/** 리뷰 요청은 이 두 날에 오늘이 더해져 3일을 채워야 열린다 */
const PAST_ACTIVE_DAYS = ['2026-10-24', '2026-10-25'];
/** 축하 화면이 가라앉기를 기다리는 시간(1.2초)보다 길게 */
const REVIEW_SETTLE_MS = 2_000;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-27T03:00:00.000Z'), doNotFake: ['nextTick'] });
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderToggle() {
  const httpClient = createHttpClientStub();
  const syncStorage = createMemoryObservableSyncStorage();
  const appStoreReviewGateway = createAppStoreReviewGatewayStub();
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

  const { queryClient } = await renderUi(
    <LocalDateProvider useDeviceCalendar={() => DEVICE_CALENDAR}>
      <Probe />
    </LocalDateProvider>,
    {
      di: { httpClient, syncStorage, appStoreReviewGateway },
    },
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
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
    appStoreReviewGateway,
    getActiveDays: () => storeReviewRepository.get(ACCOUNT_ID).activeDays,
    settleReviewWait: () => act(async () => jest.advanceTimersByTimeAsync(REVIEW_SETTLE_MS)),
    toggle,
    startToggle,
    givenList,
    invalidatedKeys,
    clearCalls: () => {
      invalidateQueries.mockClear();
    },
  };
}

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const respondWithTodo = (id: number) => ok({ message: 'ok', todo: createTodoDto({ id }) });

describe('useToggleTodoMutationOptions store review wiring', () => {
  it('오늘의 마지막 할 일을 끝낸 순간 끝낸 날을 남기고 리뷰 순간을 알린다', async () => {
    // Given
    const {
      httpClient,
      givenList,
      toggle,
      settleReviewWait,
      getActiveDays,
      appStoreReviewGateway,
    } = await renderToggle();
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
    expect(appStoreReviewGateway.requestReview).toHaveBeenCalledTimes(1);
  });

  it('어제 목록에서 여러 날 할 일을 끝내 오늘 할 일이 모두 끝나면 리뷰 순간을 알린다', async () => {
    // Given
    // 낙관적 갱신은 보고 있는 어제 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const { httpClient, givenList, toggle, settleReviewWait, appStoreReviewGateway } =
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
    expect(appStoreReviewGateway.requestReview).toHaveBeenCalledTimes(1);
  });

  it('오늘 남은 할 일이 있으면 어제 목록의 여러 날 할 일을 끝내도 리뷰 순간을 알리지 않는다', async () => {
    // Given
    const {
      httpClient,
      givenList,
      toggle,
      settleReviewWait,
      getActiveDays,
      appStoreReviewGateway,
    } = await renderToggle();
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
    expect(appStoreReviewGateway.requestReview).not.toHaveBeenCalled();
  });

  it('미완료로 되돌리거나 요청이 실패하면 아무것도 남기지 않는다', async () => {
    // Given
    const {
      httpClient,
      givenList,
      toggle,
      settleReviewWait,
      getActiveDays,
      appStoreReviewGateway,
    } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, completed: true })]);
    httpClient.patch.mockResolvedValueOnce(respondWithTodo(42));

    // When
    await toggle(42, false, TODAY);
    httpClient.patch.mockResolvedValueOnce(err(createTodoApiError()));
    await toggle(42, true, TODAY);
    await settleReviewWait();

    // Then
    expect(getActiveDays()).toEqual(PAST_ACTIVE_DAYS);
    expect(appStoreReviewGateway.requestReview).not.toHaveBeenCalled();
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

  it('하루짜리 체크가 확정되면 목록·달력은 다시 받지 않고 서버만 아는 위젯 요약만 맞춘다', async () => {
    // Given
    const { httpClient, givenList, toggle, invalidatedKeys } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
    httpClient.patch.mockResolvedValue(respondWithTodo(42));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(invalidatedKeys()).toContainEqual(TODO_QUERY_KEYS.widgetSummary());
    expect(invalidatedKeys()).not.toContainEqual(TODO_QUERY_KEYS.listByDate({ date: TODAY }));
    expect(invalidatedKeys()).not.toContainEqual(TODO_QUERY_KEYS.completionRanges());
  });

  it('체크가 실패하면 그 목록과 달력을 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { httpClient, givenList, toggle, invalidatedKeys } = await renderToggle();
    givenList(TODAY, [createParentTodo({ id: 42, startDate: TODAY, completed: false })]);
    httpClient.patch.mockResolvedValue(err(createTodoApiError()));

    // When
    await toggle(42, true, TODAY);

    // Then
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        TODO_QUERY_KEYS.listByDate({ date: TODAY }),
        TODO_QUERY_KEYS.completionRanges(),
      ]),
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
    await renderUi(<Probe />, { di: { httpClient } });

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
