import { startTodoImportRequestSchema } from '@aido/api/contracts/todo-import/v1';
import { dateKeyFieldSchema } from '@src/shared/date/date-key';
import { z } from 'zod';

import { todoImportPlanSchema } from '../domains/todo-import-plan.model';

const { timeMode, visibility } = startTodoImportRequestSchema.shape;

// 계획 모델을 넓혀 폼 값을 TodoImportPlanPolicy에 그대로 넘긴다
export const todoImportFormSchema = todoImportPlanSchema.extend({
  // 첫날과 끝 날은 늘 함께 바뀌어 한 값이다. brand는 입력 타입에 남지 않아 칸 스키마를 쓴다
  range: z.object({ startDate: dateKeyFieldSchema, endDate: dateKeyFieldSchema }),
  // null은 아직 고르지 않아 기본 선택을 쓴다
  collectionKeys: z.array(z.string()).nullable(),
  timeMode,
  visibility: visibility.unwrap(),
});
export type TodoImportFormValues = z.infer<typeof todoImportFormSchema>;
