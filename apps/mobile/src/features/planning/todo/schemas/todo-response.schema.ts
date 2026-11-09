import {
  createTodoResponseSchema,
  reorderTodoResponseSchema,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  todoRepeatSchema,
  todoSchema,
  updateTodoResponseSchema,
} from '@aido/api';
import { z } from 'zod';

/** 새 서버의 모르는 반복 빈도 하나로 응답을 버리지 않고 규칙 모르는 회차(`repeat: null`, 화면은 `↻ 반복`)로 읽는다 */
const lenientRepeatSchema = todoRepeatSchema.nullable().optional().catch(null);
const lenientTodoSchema = todoSchema.extend({ repeat: lenientRepeatSchema });

export const todoListEnvelopeSchema = todoListResponseSchema.extend({
  items: z.array(lenientTodoSchema),
});
export const createTodoEnvelopeSchema = createTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
/** 반복으로 만들면 서버는 규칙을 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const createRepeatingTodoEnvelopeSchema = createTodoEnvelopeSchema.required({
  series: true,
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
