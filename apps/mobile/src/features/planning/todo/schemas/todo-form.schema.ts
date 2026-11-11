import { createTodoSchema } from '@aido/api';
import { trimmed } from '@src/shared/schemas/trimmed.schema';
import { z } from 'zod';

import { todoRepeatSchema } from '../domains/todo-repeat.model';

const { title, categoryId, startDate, endDate, scheduledTime, isAllDay, visibility } =
  createTodoSchema.shape;

/** 할 일 만들기·고치기·메모 옮기기 폼. 날짜는 앱 시간대의 날짜 key이고 반복은 앱 모델이다 */
export const todoFormSchema = z.object({
  title: trimmed(title),
  categoryId,
  startDate,
  endDate: endDate.unwrap(),
  scheduledTime: scheduledTime.unwrap(),
  isAllDay: isAllDay.unwrap(),
  visibility: visibility.unwrap(),
  repeat: todoRepeatSchema.nullable(),
});

export type TodoFormValues = z.infer<typeof todoFormSchema>;
