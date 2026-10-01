import type { TimeFormat } from '@src/shared/utils/time';
import { groupBy } from 'es-toolkit';

import type { TodoCategoryWithCount } from '../../models/todo-category.model';
import type { TodoItem } from '../../models/todo.model';
import { toTodoItemViewModel } from './todo-item.view-model';

export function toTodoCategoryGroups(
  todos: TodoItem[],
  categories: TodoCategoryWithCount[],
  timeFormat: TimeFormat,
) {
  const grouped = groupBy(
    todos.map((todo) => toTodoItemViewModel(todo, timeFormat)),
    (todo) => todo.category.id,
  );
  return categories.map(({ id, name, color }) => ({
    category: { id, name, color },
    todos: grouped[id] ?? [],
  }));
}
