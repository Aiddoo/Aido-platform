import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { formatTime } from '@src/shared/utils/date';
import { queryOptions } from '@tanstack/react-query';

import type { TodoItem } from '../../models/todo.model';
import { TodoPolicy } from '../../models/todo.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

/** Todo ViewModel (표시용) */
export interface TodoItemViewModel extends TodoItem {
  formattedTime: string | null;
  color: string;
}

export const getTodosByDateQueryOptions = (date: string) => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.byDate(date),
    queryFn: () => todoService.getTodos({ startDate: date, endDate: date }),
    select: (data): { todos: TodoItemViewModel[] } => ({
      todos: data.todos.map((todo) => ({
        ...todo,
        formattedTime: todo.scheduledTime ? formatTime(todo.scheduledTime) : null,
        color: TodoPolicy.getColor(todo),
      })),
    }),
  });
};
