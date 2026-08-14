import { useMutation } from '@tanstack/react-query';

import { useChangeTodoCategoryMutationOptions } from '../queries/use-change-todo-category-mutation-options';
import { useToggleTodoMutationOptions } from '../queries/use-toggle-todo-mutation-options';
import { useUpdateTodoScheduleMutationOptions } from '../queries/use-update-todo-schedule-mutation-options';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';

export function useTodoActions(todo: TodoItemViewModel) {
  const toggleMutation = useMutation(useToggleTodoMutationOptions());
  const updateScheduleMutation = useMutation(useUpdateTodoScheduleMutationOptions());
  const changeCategoryMutation = useMutation(useChangeTodoCategoryMutationOptions());

  return {
    toggle: () =>
      toggleMutation.mutate({
        todoId: todo.id,
        body: { completed: !todo.completed },
        startDate: todo.startDate,
      }),
    isTogglePending: toggleMutation.isPending,

    updateSchedule: (input: {
      startDate: string;
      endDate: string | null;
      scheduledTime: string | null;
      isAllDay: boolean;
    }) => updateScheduleMutation.mutate({ todoId: todo.id, input }),

    changeCategory: (categoryId: number, callbacks?: { onSuccess?: () => void }) =>
      changeCategoryMutation.mutate({ todoId: todo.id, input: { categoryId } }, callbacks),
    isCategoryPending: changeCategoryMutation.isPending,
  };
}
