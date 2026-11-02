import { createParentTodo } from '@src/features/todo/__tests__/sub-todo.factories';
import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { useRescheduleTodoMutationOptions } from './use-reschedule-todo-mutation-options';

const mockInvalidateTodos = jest.fn();
const mockInvalidateNudgeInteractions = jest.fn();
const mockToastSuccess = jest.fn();
const mockQueryClient = { invalidateQueries: jest.fn() };

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useTodoService: () => ({ updateTodoSchedule: jest.fn() }),
}));

jest.mock('@src/features/todo/queries/todo-cache', () => ({
  invalidateTodos: (...args: unknown[]) => mockInvalidateTodos(...args),
}));

jest.mock('@src/features/nudge/queries/nudge-cache', () => ({
  invalidateNudgeInteractions: (...args: unknown[]) => mockInvalidateNudgeInteractions(...args),
}));

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: mockToastSuccess, error: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  mutationOptions: (options: unknown) => options,
  useQueryClient: () => mockQueryClient,
}));

const MUTATION_CONTEXT = { client: new QueryClient(), meta: undefined };

describe('useRescheduleTodoMutationOptions', () => {
  it('옮기기에 성공하면 할 일과 재촉 캐시를 모두 무효화하고 할 일마다 저장 토스트를 띄우지 않는다', async () => {
    // Given
    const { result } = await renderHook(() => useRescheduleTodoMutationOptions());

    // When
    await result.current.onSuccess?.(
      createParentTodo({ id: 12 }),
      {
        todoId: 12,
        input: { startDate: '2026-11-02', endDate: null, scheduledTime: '19:00', isAllDay: false },
      },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockInvalidateTodos).toHaveBeenCalledWith(mockQueryClient);
    expect(mockInvalidateNudgeInteractions).toHaveBeenCalledWith(mockQueryClient);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
