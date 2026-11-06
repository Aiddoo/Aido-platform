import {
  createTodoResponseSchema,
  reorderTodoResponseSchema,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  todoRepeatSchema,
  todoSchema,
  todoSeriesResponseSchema,
  updateTodoResponseSchema,
} from '@aido/api';
import { z } from 'zod';

/**
 * 새 서버가 더한 모르는 반복 빈도 하나 때문에 응답 전체를 버리지 않는다. 모르는 규칙은 규칙을 모르는 회차(`repeat: null`)로 읽고,
 * 화면은 이미 이 경우를 `↻ 반복`으로 그린다.
 */
const lenientRepeatSchema = todoRepeatSchema.nullable().optional().catch(null);
const lenientTodoSchema = todoSchema.extend({ repeat: lenientRepeatSchema });

export const todoListEnvelopeSchema = todoListResponseSchema.extend({
  items: z.array(lenientTodoSchema),
});
export const createTodoEnvelopeSchema = createTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const updateTodoEnvelopeSchema = updateTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const reorderTodoEnvelopeSchema = reorderTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const todoDetailsEnvelopeSchema = todoDetailsResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const todoSeriesEnvelopeSchema = todoSeriesResponseSchema.extend({
  repeat: todoRepeatSchema.nullable().catch(null),
});
