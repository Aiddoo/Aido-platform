import { useMutation } from '@tanstack/react-query';
import type { DragEndParams } from 'react-native-draggable-flatlist';

import { type SubTodo, SubTodoPolicy } from '../../models/sub-todo.model';
import { useAddSubTodoMutationOptions } from '../queries/use-add-sub-todo-mutation-options';
import { useDeleteSubTodoMutationOptions } from '../queries/use-delete-sub-todo-mutation-options';
import { useReorderSubTodosMutationOptions } from '../queries/use-reorder-sub-todos-mutation-options';
import { useToggleSubTodoMutationOptions } from '../queries/use-toggle-sub-todo-mutation-options';
import { useUpdateSubTodoMutationOptions } from '../queries/use-update-sub-todo-mutation-options';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';

export function useSubTodoActions(todo: TodoItemViewModel) {
  const addMutation = useMutation(useAddSubTodoMutationOptions());
  const toggleMutation = useMutation(useToggleSubTodoMutationOptions());
  const updateMutation = useMutation(useUpdateSubTodoMutationOptions());
  const deleteMutation = useMutation(useDeleteSubTodoMutationOptions());
  const reorderMutation = useMutation(useReorderSubTodosMutationOptions());

  return {
    add: (title: string, callbacks?: { onSuccess?: () => void }) =>
      addMutation.mutate({ todoId: todo.id, title, startDate: todo.startDate }, callbacks),
    isAddPending: addMutation.isPending,

    toggle: (subTodoId: number, completed: boolean) =>
      toggleMutation.mutate({
        todoId: todo.id,
        subTodoId,
        completed,
        startDate: todo.startDate,
      }),

    update: (subTodoId: number, title: string, callbacks?: { onSuccess?: () => void }) =>
      updateMutation.mutate(
        { todoId: todo.id, subTodoId, title, startDate: todo.startDate },
        callbacks,
      ),
    isUpdatePending: updateMutation.isPending,

    remove: (subTodoId: number, callbacks?: { onSuccess?: () => void }) =>
      deleteMutation.mutate({ todoId: todo.id, subTodoId, startDate: todo.startDate }, callbacks),
    isRemovePending: deleteMutation.isPending,

    canAdd: SubTodoPolicy.canAddSubTodo(todo),

    handleDragEnd: ({ data, from, to }: DragEndParams<SubTodo>) => {
      if (from === to || reorderMutation.isPending) return;
      reorderMutation.mutate({
        todoId: todo.id,
        subTodoIds: data.map((item) => item.id),
        startDate: todo.startDate,
      });
    },
    isReorderPending: reorderMutation.isPending,
  };
}
