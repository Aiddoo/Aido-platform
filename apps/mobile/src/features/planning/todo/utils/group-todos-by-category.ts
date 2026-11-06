import type { TodoCategoryWithCount } from '@src/features/planning/category/schemas/todo-category.schema';
import { groupBy } from 'es-toolkit';

import type { Todo } from '../schemas/todo.schema';

export function groupTodosByCategory(todos: Todo[], categories: TodoCategoryWithCount[]) {
  const grouped = groupBy(todos, (todo) => todo.category.id);
  return categories.map((category) => ({
    category,
    todos: grouped[category.id] ?? [],
  }));
}
