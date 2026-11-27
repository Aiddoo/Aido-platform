/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import { ok, fail } from '@src/core/errors/result';
import { createStoreReviewRepository } from '@src/features/device/store-review/repositories/store-review.repository';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import '@src/shared/i18n/init';
import type { DateKey } from '@src/shared/date/date-key';
import {
  createAppStoreReviewGatewayStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { useMutation } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { createTodoApiError, createTodoDto } from '../__tests__/todo.fixtures';
import type { TodoListResult } from '../domains/todo-list.model';
import type { Todo } from '../domains/todo.model';
import { TODO_QUERY_KEYS } from '../queries/todo-query-keys';
import { useToggleTodoMutationOptions } from '../queries/todo.mutations';
import { useToggleTodoWithReviewMutationOptions } from './use-toggle-todo-with-review-mutation-options';

const TODAY = createDateKey('2026-10-27');
const YESTERDAY = createDateKey('2026-10-26');
const ACCOUNT_ID = 'account-1';
/** 리뷰 요청은 이 두 날에 오늘이 더해져 3일을 채워야 열린다 */
const PAST_ACTIVE_DAYS = [createDateKey('2026-10-24'), createDateKey('2026-10-25')];
/** 축하 화면이 가라앉기를 기다리는 시간(1.2초)보다 길게 */
const REVIEW_SETTLE_MS = 2_000;

setupFakeTimersPerTest({ now: new Date('2026-10-27T03:00:00.000Z'), doNotFake: ['nextTick'] });

async function renderToggle() {
  const httpClient = createHttpClientStub();
  const syncStorage = createMemoryObservableSyncStorage();
  const appStoreReview = createAppStoreReviewGatewayStub();
  const storeReviewRepository = createStoreReviewRepository(syncStorage);
  storeReviewRepository.update(ACCOUNT_ID, (state) => ({ ...state, activeDays: PAST_ACTIVE_DAYS }));
  const { result, queryClient } = await renderScreenHook(
    () => useMutation(useToggleTodoWithReviewMutationOptions()),
    {
      di: createTestDi({ ports: { httpClient, syncStorage, appStoreReview } }),
      withLocalDate: true,
    },
  );
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));

  const toggle = async (todoId: number, completed: boolean, date: DateKey) => {
    await act(async () => {
      await result.current
        .mutateAsync({ todoId, body: { completed }, date })
        .catch(() => undefined);
    });
  };
  const givenList = (date: DateKey, todos: Todo[]) =>
    queryClient.setQueryData(TODO_QUERY_KEYS.listByDate({ date }), toList(todos));

  return {
    httpClient,
    appStoreReview,
    getActiveDays: () => storeReviewRepository.find(ACCOUNT_ID)?.activeDays,
    settleReviewWait: () => act(async () => jest.advanceTimersByTimeAsync(REVIEW_SETTLE_MS)),
    toggle,
    givenList,
  };
}

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const respondWithTodo = (id: number) => ok({ message: 'ok', todo: createTodoDto({ id }) });

describe('useToggleTodoWithReviewMutationOptions', () => {
  it('할 일 체크 옵션의 묶음 키와 오류 안내를 그대로 이어받는다', async () => {
    // When
    const { result } = await renderScreenHook(
      () => ({
        withReview: useToggleTodoWithReviewMutationOptions(),
        toggle: useToggleTodoMutationOptions(),
      }),
      { di: createTestDi(), withLocalDate: true },
    );

    // Then
    expect([result.current.withReview.mutationKey, result.current.withReview.meta]).toEqual([
      result.current.toggle.mutationKey,
      result.current.toggle.meta,
    ]);
  });

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
    httpClient.patch.mockResolvedValueOnce(fail(createTodoApiError()));
    await toggle(42, true, TODAY);
    await settleReviewWait();

    // Then
    expect(getActiveDays()).toEqual(PAST_ACTIVE_DAYS);
    expect(appStoreReview.requestReview).not.toHaveBeenCalled();
  });
});
