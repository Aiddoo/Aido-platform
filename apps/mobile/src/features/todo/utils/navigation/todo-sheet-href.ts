interface TodoSheetTarget {
  todoId: number;
  date: string;
}

interface SubTodoSheetTarget extends TodoSheetTarget {
  subTodoId: number;
}

export type TodoSheetAction = 'edit' | 'date' | 'time' | 'category';

export const TODO_SHEET_FALLBACK_HREF = '/feed';

export const TODO_CATEGORY_SHEET_FALLBACK_HREF = '/settings/category-settings';

export function todoActionsSheetHref({ todoId, date }: TodoSheetTarget) {
  return {
    pathname: '/todo/[todoId]/actions',
    params: { todoId: String(todoId), date },
  } as const;
}

export function todoActionSheetHref(action: TodoSheetAction, { todoId, date }: TodoSheetTarget) {
  return {
    pathname: `/todo/[todoId]/${action}`,
    params: { todoId: String(todoId), date },
  } as const;
}

export function todoThanksSheetHref({ todoId }: Pick<TodoSheetTarget, 'todoId'>) {
  return { pathname: '/todo/[todoId]/thanks', params: { todoId: String(todoId) } } as const;
}

export function todoCreateSheetHref({ date, categoryId }: { date: string; categoryId: number }) {
  return { pathname: '/todo/new', params: { date, categoryId: String(categoryId) } } as const;
}

export function subTodoCreateSheetHref({ todoId, date }: TodoSheetTarget) {
  return {
    pathname: '/todo/[todoId]/sub-todos/new',
    params: { todoId: String(todoId), date },
  } as const;
}

export function subTodoSheetHref(
  action: 'actions' | 'edit',
  { todoId, date, subTodoId }: SubTodoSheetTarget,
) {
  return {
    pathname: `/todo/[todoId]/sub-todos/[subTodoId]/${action}`,
    params: { todoId: String(todoId), subTodoId: String(subTodoId), date },
  } as const;
}

export function todoCategoryCreateSheetHref() {
  return '/todo-categories/new' as const;
}

export function todoCategoryEditSheetHref({ categoryId }: { categoryId: number }) {
  return {
    pathname: '/todo-categories/[categoryId]/edit',
    params: { categoryId: String(categoryId) },
  } as const;
}
