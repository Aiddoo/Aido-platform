import type { SubTodo } from '../../domains/sub-todo.model';
import type { TodoCategory } from '../../domains/todo-category.model';
import type { Todo } from '../../domains/todo.model';

/** 시트 route의 대상 할 일. 목록에서 사라졌으면(삭제·다른 날짜) null. */
export function findSheetTodo(todos: Todo[], todoId: number): Todo | null {
  return todos.find((todo) => todo.id === todoId) ?? null;
}

export function findSheetCategory<T extends TodoCategory>(
  categories: T[],
  categoryId: number,
): T | null {
  return categories.find((category) => category.id === categoryId) ?? null;
}

export function findSheetSubTodo(todo: Todo | null, subTodoId: number): SubTodo | null {
  return todo?.subTodos.find((subTodo) => subTodo.id === subTodoId) ?? null;
}
