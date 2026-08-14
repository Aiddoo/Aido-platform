import { renderHook } from '@testing-library/react-native';

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

jest.mock('@src/features/activation/presentations/activation-mutations', () => ({
  recordTodoCompletionForActivation: (...args: unknown[]) =>
    mockRecordTodoCompletionForActivation(...args),
}));

jest.mock('@src/shared/analytics', () => ({
  useTrack: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('@tanstack/react-query', () => ({
  mutationOptions: (options: unknown) => options,
  useQueryClient: () => mockQueryClient,
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Error: 'error' },
}));

jest.mock('../hooks/use-store-review-prompt', () => ({
  useStoreReviewPrompt: () => ({
    promptAfterSuccessfulCompletion: mockPromptAfterSuccessfulCompletion,
  }),
}));

describe('useToggleTodoMutationOptions store review wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPromptAfterSuccessfulCompletion.mockResolvedValue(false);
    mockRecordTodoCompletionForActivation.mockReturnValue(null);
  });

  it('서버에서 완료 전환에 성공한 뒤에만 리뷰 정책에 완료를 기록한다', async () => {
    // Given
    const { result } = await renderHook(() => useToggleTodoMutationOptions());
    const onSuccess = result.current.onSuccess as (...args: unknown[]) => Promise<void> | void;

    // When
    await onSuccess(
      undefined,
      {
        todoId: 42,
        body: { completed: true },
        startDate: '2026-07-26',
      },
      undefined,
      undefined,
    );

    // Then
    expect(mockPromptAfterSuccessfulCompletion).toHaveBeenCalledTimes(1);
    expect(mockPromptAfterSuccessfulCompletion).toHaveBeenCalledWith(42);
  });

  it('미완료 전환이나 오류 경로에서는 리뷰 프롬프트를 시도하지 않는다', async () => {
    // Given
    const { result } = await renderHook(() => useToggleTodoMutationOptions());
    const onSuccess = result.current.onSuccess as (...args: unknown[]) => Promise<void> | void;
    const onError = result.current.onError as (...args: unknown[]) => Promise<void> | void;

    // When
    await onSuccess(
      undefined,
      {
        todoId: 42,
        body: { completed: false },
        startDate: '2026-07-26',
      },
      undefined,
      undefined,
    );
    await onError(
      new Error('request failed'),
      {
        todoId: 42,
        body: { completed: true },
        startDate: '2026-07-26',
      },
      undefined,
      undefined,
    );

    // Then
    expect(mockPromptAfterSuccessfulCompletion).not.toHaveBeenCalled();
  });
});
