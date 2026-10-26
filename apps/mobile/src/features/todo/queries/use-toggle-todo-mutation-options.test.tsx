import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.factories';
import type { Todo } from '../domains/todo.model';
import { useToggleTodoMutationOptions } from './use-toggle-todo-mutation-options';

const TODAY = '2026-10-27';
const YESTERDAY = '2026-10-26';
const mockRecordActiveDay = jest.fn();
const mockRequestReviewAt = jest.fn();
const mockRecordTodoCompletionForActivation = jest.fn();
const mockTrackEvent = jest.fn();
const mockQueryClient = {
  cancelQueries: jest.fn(),
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
};

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useTodoService: () => ({ toggleTodoComplete: jest.fn() }),
  useActivationService: () => ({ recordTodoCompletion: jest.fn() }),
}));

jest.mock('@src/features/activation/queries/activation-cache', () => ({
  recordTodoCompletionForActivation: (...args: unknown[]) =>
    mockRecordTodoCompletionForActivation(...args),
}));

jest.mock('@src/shared/analytics', () => ({
  useTrack: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('@src/shared/hooks/use-today', () => ({
  useTodayKey: () => TODAY,
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  mutationOptions: (options: unknown) => options,
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@src/shared/utils/haptics');

jest.mock('@src/features/store-review/hooks/use-store-review-moment', () => ({
  useStoreReviewMoment: () => ({
    recordActiveDay: mockRecordActiveDay,
    requestReviewAt: mockRequestReviewAt,
  }),
}));

const MUTATION_CONTEXT = { client: new QueryClient(), meta: undefined };

const givenTodayTodos = (todos: Todo[]) => {
  mockQueryClient.getQueryData.mockReturnValue({ todos, hasNext: false, nextCursor: null });
};

const completeTodo = async (todoId: number, completed = true, startDate = TODAY) => {
  const { result } = await renderHook(() => useToggleTodoMutationOptions());
  await result.current.onSuccess?.(
    createParentTodo({ id: todoId }),
    { todoId, body: { completed }, startDate },
    { completed: !completed, startDate },
    MUTATION_CONTEXT,
  );
};

describe('useToggleTodoMutationOptions store review wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordTodoCompletionForActivation.mockReturnValue(null);
  });

  it('오늘의 마지막 할 일을 끝낸 순간 끝낸 날을 남기고 리뷰 순간을 알린다', async () => {
    // Given 낙관적 갱신으로 오늘 목록이 모두 완료로 보인다
    givenTodayTodos([
      createParentTodo({ id: 41, completed: true }),
      createParentTodo({ id: 42, completed: true }),
    ]);

    // When
    await completeTodo(42);

    // Then
    expect(mockRecordActiveDay).toHaveBeenCalledTimes(1);
    expect(mockRequestReviewAt).toHaveBeenCalledWith('all_todos_done');
  });

  it('어제 시작한 여러 날 할 일을 오늘 마지막으로 끝내면 리뷰 순간을 알리고 남은 할 일이 있으면 알리지 않는다', async () => {
    // Given 낙관적 갱신은 시작일(어제) 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const multiDay = createParentTodo({
      id: 7,
      startDate: YESTERDAY,
      endDate: TODAY,
      completed: false,
    });
    givenTodayTodos([createParentTodo({ id: 41, completed: true }), multiDay]);

    // When
    await completeTodo(7, true, YESTERDAY);

    // Then
    expect(mockRequestReviewAt).toHaveBeenCalledWith('all_todos_done');

    // Given 오늘 남은 할 일이 하나 더 있다
    jest.clearAllMocks();
    givenTodayTodos([createParentTodo({ id: 41, completed: false }), multiDay]);

    // When
    await completeTodo(7, true, YESTERDAY);

    // Then
    expect(mockRequestReviewAt).not.toHaveBeenCalled();
  });

  it('남은 할 일이 있으면 끝낸 날만 남기고 리뷰 순간은 알리지 않는다', async () => {
    // Given
    givenTodayTodos([
      createParentTodo({ id: 41, completed: false }),
      createParentTodo({ id: 42, completed: true }),
    ]);

    // When
    await completeTodo(42);

    // Then
    expect(mockRecordActiveDay).toHaveBeenCalledTimes(1);
    expect(mockRequestReviewAt).not.toHaveBeenCalled();
  });

  it('미완료로 되돌리거나 요청이 실패하면 아무것도 남기지 않는다', async () => {
    // Given
    givenTodayTodos([createParentTodo({ id: 42, completed: false })]);
    const { result } = await renderHook(() => useToggleTodoMutationOptions());

    // When
    await completeTodo(42, false);
    await result.current.onError?.(
      new Error('request failed'),
      { todoId: 42, body: { completed: true }, startDate: TODAY },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockRecordActiveDay).not.toHaveBeenCalled();
    expect(mockRequestReviewAt).not.toHaveBeenCalled();
  });
});
