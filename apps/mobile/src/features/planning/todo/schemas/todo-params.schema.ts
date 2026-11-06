import {
  createTodoSchema,
  timeOfDaySchema,
  todoCategoryIdParamSchema,
  todoDetailsParamSchema,
  todoItemIdParamSchema,
} from '@aido/api';
import { routeIntegerStringSchema } from '@src/shared/utils/route-params';
import { z } from 'zod';

import { feedParamsSchema } from './feed-params.schema';

export const todoScreenParamsSchema = z.object({
  todoId: routeIntegerStringSchema.pipe(todoDetailsParamSchema.shape.todoId),
});

export const subTodoScreenParamsSchema = todoScreenParamsSchema.extend({
  subTodoId: routeIntegerStringSchema.pipe(todoItemIdParamSchema.shape.itemId),
});

export const todoSheetDateParamsSchema = feedParamsSchema.pick({ date: true });

export const todoCreateCategoryParamsSchema = z.object({
  categoryId: routeIntegerStringSchema
    .pipe(todoCategoryIdParamSchema.shape.id)
    .optional()
    .catch(undefined),
});

export const todoCreatePrefillParamsSchema = z.object({
  title: createTodoSchema.shape.title.optional().catch(undefined),
  time: timeOfDaySchema.optional().catch(undefined),
});

export const todoCreateVoiceHintParamsSchema = z.object({
  voiceHint: z.literal('1').optional().catch(undefined),
});
