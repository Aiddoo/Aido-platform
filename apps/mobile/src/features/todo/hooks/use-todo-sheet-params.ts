import { dateSchema, todoCategoryIdParamSchema, todoItemIdParamSchema } from '@aido/api';
import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

import { todoScreenParamsSchema } from './use-todo-screen-params';

const sheetDateSchema = z.object({ date: dateSchema });
const subTodoIdSchema = z.object({
  subTodoId: routeIntegerStringSchema.pipe(todoItemIdParamSchema.shape.itemId),
});
const categoryIdSchema = z.object({
  categoryId: routeIntegerStringSchema.pipe(todoCategoryIdParamSchema.shape.id),
});

/** 할 일 시트 route: 대상 할 일과, 그 할 일을 읽어 올 목록 날짜. */
export const todoSheetParamsSchema = todoScreenParamsSchema.extend(sheetDateSchema.shape);

export const subTodoSheetParamsSchema = todoSheetParamsSchema.extend(subTodoIdSchema.shape);

export const todoCreateParamsSchema = sheetDateSchema.extend(categoryIdSchema.shape);

export const todoCategorySheetParamsSchema = categoryIdSchema;

/** 시트가 할 일을 읽어 올 목록 날짜(YYYY-MM-DD). */
export function useTodoSheetDateParam() {
  const { date } = sheetDateSchema.parse(useRouteSearchParams());
  return [date] as const;
}

export function useTodoCreateSheetParams() {
  return todoCreateParamsSchema.parse(useRouteSearchParams());
}

export function useSubTodoSheetParams() {
  return subTodoIdSchema.parse(useRouteSearchParams());
}

export function useTodoCategorySheetParams() {
  return categoryIdSchema.parse(useRouteSearchParams());
}
