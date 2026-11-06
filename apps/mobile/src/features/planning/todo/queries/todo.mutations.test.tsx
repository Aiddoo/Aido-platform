import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderHook } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import type { Todo } from '../schemas/todo.schema';
import { useToggleTodoMutationOptions } from './todo.mutations';

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
  setQueriesData: jest.fn(),
  invalidateQueries: jest.fn(),
  isMutating: jest.fn(),
};

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useHaptics: () => ({ selection: jest.fn(), impact: jest.fn(), notify: jest.fn() }),
  useTodoService: () => ({ toggleTodoComplete: jest.fn() }),
  useActivationService: () => ({ recordTodoCompletion: jest.fn() }),
}));

jest.mock('@src/features/device/activation/queries/activation-cache', () => ({
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

jest.mock('@src/features/device/store-review/hooks/use-store-review-moment', () => ({
  useStoreReviewMoment: () => ({
    recordActiveDay: mockRecordActiveDay,
    requestReviewAt: mockRequestReviewAt,
  }),
}));

const MUTATION_CONTEXT = { client: createTestQueryClient(), meta: undefined };

const givenTodayTodos = (todos: Todo[]) => {
  mockQueryClient.getQueryData.mockReturnValue({ todos, hasNext: false, nextCursor: null });
};

const completeTodo = async (todoId: number, completed = true, date = TODAY) => {
  const { result } = await renderHook(() => useToggleTodoMutationOptions());
  await result.current.onSuccess?.(
    createParentTodo({ id: todoId }),
    { todoId, body: { completed }, date },
    undefined,
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

  it('어제 목록에서 여러 날 할 일을 끝내 오늘 할 일이 모두 끝나면 리뷰 순간을 알리고 남은 할 일이 있으면 알리지 않는다', async () => {
    // Given 낙관적 갱신은 보고 있는 어제 목록에만 반영돼 오늘 목록에는 아직 미완료다
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
      { todoId: 42, body: { completed: true }, date: TODAY },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockRecordActiveDay).not.toHaveBeenCalled();
    expect(mockRequestReviewAt).not.toHaveBeenCalled();
  });
});

describe('useToggleTodoMutationOptions settle', () => {
  const settle = async (date = TODAY) => {
    const { result } = await renderHook(() => useToggleTodoMutationOptions());
    await result.current.onSettled?.(
      createParentTodo({ id: 42 }),
      null,
      { todoId: 42, body: { completed: true }, date },
      undefined,
      MUTATION_CONTEXT,
    );
  };
  const invalidatedKeys = () =>
    mockQueryClient.invalidateQueries.mock.calls.map(([filters]) => filters.queryKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('다른 체크가 아직 진행 중이면 목록을 다시 부르지 않아 낙관적 값이 깜빡이지 않는다', async () => {
    // Given
    mockQueryClient.isMutating.mockReturnValue(2);

    // When
    await settle();

    // Then
    expect(invalidatedKeys()).not.toContainEqual(['todo', 'list']);
  });

  it('마지막 체크가 끝나면 목록과 완료 기록을 다시 부른다', async () => {
    // Given
    mockQueryClient.isMutating.mockReturnValue(1);

    // When
    await settle();

    // Then
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        ['todo', 'list'],
        ['todo', 'completion'],
      ]),
    );
  });

  it('지난 날짜를 체크하면 그 해의 주간 달성 목록을 다시 부른다', async () => {
    // Given
    mockQueryClient.isMutating.mockReturnValue(1);

    // When
    await settle(YESTERDAY);

    // Then
    expect(invalidatedKeys()).toContainEqual(['achievement', 'weekly-list', { year: 2026 }]);
  });
});
