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

/** 요청한 카테고리가 아직 있으면 그것을, 없으면 첫 카테고리를 처음 선택값으로 쓴다. */
export function resolveSheetCategoryId(
  requestedCategoryId: number | null | undefined,
  categories: Pick<TodoCategory, 'id'>[],
): number | null {
  if (
    requestedCategoryId != null &&
    categories.some((category) => category.id === requestedCategoryId)
  ) {
    return requestedCategoryId;
  }
  return categories[0]?.id ?? null;
}
