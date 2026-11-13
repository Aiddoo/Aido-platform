import { useRetainedValue } from '@src/shared/hooks/use-retained-value';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import type { SubTodo } from '../domains/sub-todo.model';
import { type Todo, TodoPolicy } from '../domains/todo.model';
import { useGetTodosByDateQueryOptions } from '../queries/todo.queries';
import { useSubTodoId, useTodoId } from './use-todo-params';
import { useTodoSheetDateKey } from './use-todo-sheet-date-key';

interface SheetTargetOptions {
  /** 대상이 그날 목록에 없을 때(지웠거나 다른 날로 옮김, 잘못된 링크) 시트를 닫는다 */
  onMissing: () => void;
}

/**
 * 할 일 시트 route(`/todo/[todoId]/…?date=`)의 대상 할 일. 그날 목록에서 찾고,
 * 지워져 사라져도 닫히는 동안은 마지막 값을 보인다. 처음부터 없으면 null이고 onMissing을 부른다
 */
export function useSheetTodo({ onMissing }: SheetTargetOptions): Todo | null {
  const [todoId] = useTodoId();
  const [date] = useTodoSheetDateKey();
  const { data: todosByDate } = useSuspenseQuery(useGetTodosByDateQueryOptions({ date }));
  const todo = useRetainedValue(TodoPolicy.findTodo(todosByDate.todos, todoId));

  useCloseWhenMissing(todo, onMissing);

  return todo;
}

/** 하위 할 일 시트 route(`/todo/[todoId]/sub-todos/[subTodoId]/…`)의 대상. 할 일이나 하위 할 일이 없으면 null이다 */
export function useSheetSubTodo({
  onMissing,
}: SheetTargetOptions): { todo: Todo; subTodo: SubTodo } | null {
  const [subTodoId] = useSubTodoId();
  const todo = useSheetTodo({ onMissing });
  const subTodo = useRetainedValue(TodoPolicy.findSubTodo(todo, subTodoId));

  useCloseWhenMissing(subTodo, onMissing);

  return todo == null || subTodo == null ? null : { todo, subTodo };
}

function useCloseWhenMissing(target: unknown, onMissing: () => void) {
  const handleMissing = useEffectEvent(onMissing);
  const isMissing = target == null;

  useEffect(() => {
    if (isMissing) {
      handleMissing();
    }
  }, [isMissing]);
}
