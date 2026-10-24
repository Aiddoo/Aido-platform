import { todoCategoryIdParamSchema, todoItemIdParamSchema } from '@aido/api';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { feedDateParamSchema } from '../utils/feed-date-param';
import { todoScreenParamsSchema } from './use-todo-screen-params';

const sheetDateSearchSchema = z.object({ date: feedDateParamSchema });
const createCategorySearchSchema = z.object({
  categoryId: routeIntegerStringSchema
    .pipe(todoCategoryIdParamSchema.shape.id)
    .optional()
    .catch(undefined),
});

type SheetDateParam = z.output<typeof sheetDateSearchSchema>['date'];
type CreateCategoryParam = z.output<typeof createCategorySearchSchema>['categoryId'];

export const subTodoScreenParamsSchema = todoScreenParamsSchema.extend({
  subTodoId: routeIntegerStringSchema.pipe(todoItemIdParamSchema.shape.itemId),
});

export const todoCategoryScreenParamsSchema = z.object({
  categoryId: routeIntegerStringSchema.pipe(todoCategoryIdParamSchema.shape.id),
});

function toSheetDateKey(date: SheetDateParam, todayKey: string): string {
  return date === undefined || date === 'today' ? todayKey : date;
}

/** 시트가 할 일을 읽어 올 목록 날짜(YYYY-MM-DD). 없거나 잘못되면 오늘이다. */
export function useTodoSheetDateParam(): readonly [string] {
  const { date } = sheetDateSearchSchema.parse(useLocalSearchParams());
  return [toSheetDateKey(date, useTodayKey())] as const;
}

/** 할 일 추가 시트가 처음 고를 카테고리. 없거나 잘못되면 undefined다. */
export function useTodoCreateCategoryParam(): readonly [CreateCategoryParam] {
  const { categoryId } = createCategorySearchSchema.parse(useLocalSearchParams());
  return [categoryId] as const;
}

export function useSubTodoScreenParams() {
  return subTodoScreenParamsSchema.parse(useLocalSearchParams());
}

export function useTodoCategoryScreenParams() {
  return todoCategoryScreenParamsSchema.parse(useLocalSearchParams());
}
