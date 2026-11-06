import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/use-update-todo-schedule-mutation-options';
import { invalidateNudgeInteractions } from '@src/features/social/nudge/queries/nudge-cache';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

/**
 * 할 일 일정 수정 mutation을 그대로 쓰되, 여러 할 일을 한 번에 옮길 때 할 일마다 뜨는 저장 토스트만 뺀다.
 * 원래 onSuccess가 하던 할 일·재촉 캐시 무효화는 같은 cache helper로 그대로 한다. 실패 토스트는 원래 그대로다.
 */
export const useRescheduleTodoMutationOptions = () => {
  const queryClient = useQueryClient();
  const updateScheduleOptions = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({
    ...updateScheduleOptions,
    onSuccess: () =>
      Promise.all([invalidateTodos(queryClient), invalidateNudgeInteractions(queryClient)]),
  });
};
