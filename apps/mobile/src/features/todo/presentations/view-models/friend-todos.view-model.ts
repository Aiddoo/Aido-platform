import type { TimeFormat } from '@src/shared/utils/time';
import { groupBy } from 'es-toolkit';

import type { TodosResult } from '../../models/todo.model';
import { toTodoItemViewModel } from './todo-item.view-model';

export function toFriendCategoryGroups(data: TodosResult, timeFormat: TimeFormat) {
  const todos = data.todos.map((todo) => toTodoItemViewModel(todo, timeFormat));
  return Object.values(groupBy(todos, (todo) => todo.category.id)).flatMap((items) => {
    const first = items[0];
    return first ? [{ category: first.category, todos: items }] : [];
  });
}
