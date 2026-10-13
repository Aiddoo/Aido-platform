import { groupBy } from 'es-toolkit';

import type { TodoListResult } from '../../domains/todo.model';

export function toFriendCategoryGroups(data: TodoListResult) {
  const todos = data.todos;
  return Object.values(groupBy(todos, (todo) => todo.category.id)).flatMap((items) => {
    const first = items[0];
    return first ? [{ category: first.category, todos: items }] : [];
  });
}
