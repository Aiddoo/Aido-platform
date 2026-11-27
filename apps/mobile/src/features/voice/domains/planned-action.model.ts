import { ACTION_PLAN_LIMITS, TODO_ITEM_LIMITS, TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { todoRepeatSchema } from '@src/features/planning/todo/domains/todo-repeat.model';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

const plannedActionIdSchema = z.string().min(1);

const plannedTodoShape = {
  type: z.literal('create-todo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  startDate: dateKeyFieldSchema,
  endDate: dateKeyFieldSchema.nullable(),
  scheduledTime: z.iso.time({ precision: -1 }).nullable(),
  repeat: todoRepeatSchema.nullable(),
  visibility: z.enum(TODO_VISIBILITIES).nullable(),
  items: z
    .array(
      z.object({ title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH) }),
    )
    .max(TODO_ITEM_LIMITS.MAX_PER_TODO),
  categoryId: z.int().positive().nullable(),
  duplicateOfTodoId: z.int().positive().nullable(),
};

const plannedMemoShape = {
  type: z.literal('create-memo'),
  actionId: plannedActionIdSchema,
  title: z.string().trim().max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1),
};

// 서버가 저장 때 막는 규칙(반복에는 종료일 없음, 종료일은 시작일 이후)을 카드를 고치는 동안에도 지킨다
export const plannedTodoSchema = z
  .object(plannedTodoShape)
  .refine((todo) => todo.repeat == null || todo.endDate == null, { path: ['endDate'] })
  .refine((todo) => todo.endDate == null || todo.startDate <= todo.endDate, { path: ['endDate'] });
export const plannedMemoSchema = z.object(plannedMemoShape);

export const plannedActionSchema = z.discriminatedUnion('type', [
  plannedTodoSchema,
  plannedMemoSchema,
]);
export type PlannedTodo = z.infer<typeof plannedTodoSchema>;
export type PlannedMemo = z.infer<typeof plannedMemoSchema>;
export type PlannedAction = z.infer<typeof plannedActionSchema>;

// 카테고리를 정하지 않은 할 일은 시트의 현재 카테고리에 넣는다. 고르는 폼 카드도 같은 규칙이라 카테고리 값만 받는다
export function getPlannedCategoryId(
  categoryId: number | null,
  fallbackCategoryId: number,
): number {
  return categoryId ?? fallbackCategoryId;
}

export const PlannedActionPolicy = {
  isTodoAction(action: PlannedAction): action is PlannedTodo {
    return action.type === 'create-todo';
  },

  isDuplicateAction(action: PlannedAction): boolean {
    return this.isTodoAction(action) && action.duplicateOfTodoId != null;
  },
};
