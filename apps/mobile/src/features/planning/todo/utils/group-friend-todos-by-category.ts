import { groupBy } from 'es-toolkit';

import type { Todo } from '../domains/todo.model';

export function groupFriendTodosByCategory(todos: readonly Todo[]) {
  return Object.values(groupBy(todos, (todo) => todo.category.id)).flatMap((items) => {
    const first = items[0];
    return first ? [{ category: first.category, todos: items }] : [];
  });
}
