import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { createParentTodo } from '../__tests__/sub-todo.factories';
import { useToggleTodoMutationOptions } from './use-toggle-todo-mutation-options';

const mockPromptAfterSuccessfulCompletion = jest.fn();
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

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  mutationOptions: (options: unknown) => options,
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@src/shared/utils/haptics');

jest.mock('../hooks/use-store-review-prompt', () => ({
  useStoreReviewPrompt: () => ({
    promptAfterSuccessfulCompletion: mockPromptAfterSuccessfulCompletion,
  }),
}));

const MUTATION_CONTEXT = { client: new QueryClient(), meta: undefined };

describe('useToggleTodoMutationOptions store review wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPromptAfterSuccessfulCompletion.mockResolvedValue(false);
    mockRecordTodoCompletionForActivation.mockReturnValue(null);
  });

  it('서버에서 완료 전환에 성공한 뒤에만 리뷰 정책에 완료를 기록한다', async () => {
    // Given
    const { result } = await renderHook(() => useToggleTodoMutationOptions());

    // When
    await result.current.onSuccess?.(
      createParentTodo({ id: 42 }),
      {
        todoId: 42,
        body: { completed: true },
        startDate: '2026-07-26',
      },
      { completed: false, startDate: '2026-07-26' },
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockPromptAfterSuccessfulCompletion).toHaveBeenCalledTimes(1);
    expect(mockPromptAfterSuccessfulCompletion).toHaveBeenCalledWith(42);
  });

  it('미완료 전환이나 오류 경로에서는 리뷰 프롬프트를 시도하지 않는다', async () => {
    // Given
    const { result } = await renderHook(() => useToggleTodoMutationOptions());

    // When
    await result.current.onSuccess?.(
      createParentTodo({ id: 42 }),
      {
        todoId: 42,
        body: { completed: false },
        startDate: '2026-07-26',
      },
      { completed: false, startDate: '2026-07-26' },
      MUTATION_CONTEXT,
    );
    await result.current.onError?.(
      new Error('request failed'),
      {
        todoId: 42,
        body: { completed: true },
        startDate: '2026-07-26',
      },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockPromptAfterSuccessfulCompletion).not.toHaveBeenCalled();
  });
});
