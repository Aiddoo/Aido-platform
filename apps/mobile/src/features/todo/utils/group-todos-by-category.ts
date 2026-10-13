import { groupBy } from 'es-toolkit';

import type { TodoCategoryWithCount } from '../domains/todo-category.model';
import type { Todo } from '../domains/todo.model';

export function toTodoCategoryGroups(todos: Todo[], categories: TodoCategoryWithCount[]) {
  const grouped = groupBy(todos, (todo) => todo.category.id);
  return categories.map((category) => ({
    category,
    todos: grouped[category.id] ?? [],
  }));
}
