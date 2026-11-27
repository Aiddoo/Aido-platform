import { useStoreReviewMoment } from '@src/features/device/store-review/hooks/use-store-review-moment';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { TodoListPolicy } from '../domains/todo-list.model';
import { getCachedTodoListByDate } from '../queries/todo-cache';
import { type ToggleTodoVariables, useToggleTodoMutationOptions } from '../queries/todo.mutations';

// 리뷰는 이 옵션을 부른 화면이 가라앉은 뒤에만 묻도록 그 화면 안에서 리뷰 훅을 부른다
export function useToggleTodoWithReviewMutationOptions() {
  const toggleTodoOptions = useToggleTodoMutationOptions();
  const queryClient = useQueryClient();
  const todayKey = useTodayKey();
  const { recordActiveDay, requestReviewAt } = useStoreReviewMoment();

  return mutationOptions({
    ...toggleTodoOptions,
    // 캐시 갱신·완료 이벤트(옵션의 onSuccess)를 먼저 끝내야 오늘 목록이 이번 완료를 반영한다
    onSuccess: (saved, variables: ToggleTodoVariables, onMutateResult, context) => {
      toggleTodoOptions.onSuccess?.(saved, variables, onMutateResult, context);
      if (!variables.body.completed) {
        return;
      }
      recordActiveDay();
      // 오늘 목록의 마지막 할 일을 끝낸 순간 — 피드의 '다 끝낸 날' 배너와 같은 순간이다
      const todayTodos = getCachedTodoListByDate(queryClient, { date: todayKey });
      if (TodoListPolicy.isLastOpenTodo(todayTodos, variables.todoId)) {
        requestReviewAt('all_todos_done');
      }
    },
  });
}
