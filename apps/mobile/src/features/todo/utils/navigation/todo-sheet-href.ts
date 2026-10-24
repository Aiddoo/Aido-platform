import { match } from 'ts-pattern';

interface TodoSheetTarget {
  todoId: number;
  date: string;
}

interface SubTodoSheetTarget extends TodoSheetTarget {
  subTodoId: number;
}

export type TodoSheetAction = 'edit' | 'date' | 'time' | 'category';

export const TODO_SHEET_FALLBACK_HREF = { pathname: '/feed' } as const;

export const TODO_CATEGORY_SHEET_FALLBACK_HREF = {
  pathname: '/settings/category-settings',
} as const;

export function todoActionsSheetHref({ todoId, date }: TodoSheetTarget) {
  return { pathname: '/todo/[todoId]/actions', params: { todoId, date } } as const;
}

/** 동작 시트에서 이어지는 수정·날짜·시간·카테고리 시트. */
export function todoActionSheetHref(action: TodoSheetAction, { todoId, date }: TodoSheetTarget) {
  const params = { todoId, date };
  return match(action)
    .with('edit', () => ({ pathname: '/todo/[todoId]/edit', params }) as const)
    .with('date', () => ({ pathname: '/todo/[todoId]/date', params }) as const)
    .with('time', () => ({ pathname: '/todo/[todoId]/time', params }) as const)
    .with('category', () => ({ pathname: '/todo/[todoId]/category', params }) as const)
    .exhaustive();
}

export function todoThanksSheetHref({ todoId }: Pick<TodoSheetTarget, 'todoId'>) {
  return { pathname: '/todo/[todoId]/thanks', params: { todoId } } as const;
}

export function todoCreateSheetHref({ date, categoryId }: { date: string; categoryId: number }) {
  return { pathname: '/todo/new', params: { date, categoryId } } as const;
}

export function subTodoCreateSheetHref({ todoId, date }: TodoSheetTarget) {
  return { pathname: '/todo/[todoId]/sub-todos/new', params: { todoId, date } } as const;
}

export function subTodoActionsSheetHref({ todoId, subTodoId, date }: SubTodoSheetTarget) {
  return {
    pathname: '/todo/[todoId]/sub-todos/[subTodoId]/actions',
    params: { todoId, subTodoId, date },
  } as const;
}

export function subTodoEditSheetHref({ todoId, subTodoId, date }: SubTodoSheetTarget) {
  return {
    pathname: '/todo/[todoId]/sub-todos/[subTodoId]/edit',
    params: { todoId, subTodoId, date },
  } as const;
}

export function todoCategoryCreateSheetHref() {
  return { pathname: '/todo-categories/new' } as const;
}

export function todoCategoryEditSheetHref({ categoryId }: { categoryId: number }) {
  return { pathname: '/todo-categories/[categoryId]/edit', params: { categoryId } } as const;
}
