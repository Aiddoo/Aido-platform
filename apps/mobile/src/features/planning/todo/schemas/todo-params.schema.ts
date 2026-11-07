import {
  createTodoSchema,
  timeOfDaySchema,
  todoCategoryIdParamSchema,
  todoDetailsParamSchema,
  todoItemIdParamSchema,
} from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/schemas/route-params.schema';
import { z } from 'zod';

import { feedParamsSchema } from './feed-params.schema';

export const todoParamsSchema = z.object({
  todoId: routeIntegerStringSchema.pipe(todoDetailsParamSchema.shape.todoId),
});

export const subTodoParamsSchema = todoParamsSchema.extend({
  subTodoId: routeIntegerStringSchema.pipe(todoItemIdParamSchema.shape.itemId),
});

export const todoSheetDateParamsSchema = feedParamsSchema.pick({ date: true });

/** 할 일 추가 시트의 시작 값. 다른 화면이 제안한 카테고리·제목·시각과 말하기 안내다. 잘못된 값은 버리고 빈 시트로 연다 */
export const todoCreateParamsSchema = z.object({
  categoryId: routeIntegerStringSchema
    .pipe(todoCategoryIdParamSchema.shape.id)
    .optional()
    .catch(undefined),
  title: createTodoSchema.shape.title.optional().catch(undefined),
  time: timeOfDaySchema.optional().catch(undefined),
  voiceHint: z.literal('1').optional().catch(undefined),
});
