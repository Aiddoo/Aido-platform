import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import type { TimeFormat } from '@src/shared/utils/time';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { groupBy } from 'es-toolkit';

import type { TodoCategoryWithCount } from '../../models/todo-category.model';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { type TodoItemViewModel, toTodoItemViewModel } from '../view-models/todo-item.view-model';

export interface CategoryGroup {
  category: { id: number; name: string; color: string };
  todos: TodoItemViewModel[];
}

export const useGetTodosByCategoryQueryOptions = (
  date: string,
  timeFormat: TimeFormat,
  categories: TodoCategoryWithCount[],
) => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate(date),
    queryFn: async () => {
      const result = await todoService.getTodos({ startDate: date, endDate: date, size: 200 });
      return unwrap(result);
    },
    select: (data): CategoryGroup[] => {
      const viewModels = data.todos.map((todo) => toTodoItemViewModel(todo, timeFormat));
      const grouped = groupBy(viewModels, (todo) => todo.category.id);
      return categories.map((c) => ({
        category: { id: c.id, name: c.name, color: c.color },
        todos: grouped[c.id] ?? [],
      }));
    },
    placeholderData: keepPreviousData,
  });
};
