import { DAYS_OF_WEEK, TODO_EDIT_SCOPES, TODO_UPDATE_SCOPES } from '@aido/api/vocabulary';
import { z } from 'zod';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';

const todoEditScopeSchema = z.enum(TODO_EDIT_SCOPES);
export type TodoEditScope = z.infer<typeof todoEditScopeSchema>;
/** 수정에는 전체 범위가 없다. 첫 회차에서 이후를 고르면 전체를 고친 것과 같다 */
const todoUpdateScopeSchema = z.enum(TODO_UPDATE_SCOPES);
export type TodoUpdateScope = z.infer<typeof todoUpdateScopeSchema>;

const todoRepeatEndSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NEVER') }),
  z.object({ type: z.literal('UNTIL'), date: z.iso.date() }),
  z.object({
    type: z.literal('COUNT'),
    count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
  }),
]);
export type TodoRepeatEnd = z.infer<typeof todoRepeatEndSchema>;

export const todoRepeatSchema = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('DAILY'), end: todoRepeatEndSchema }),
  z.object({
    frequency: z.literal('WEEKLY'),
    interval: z.union([z.literal(1), z.literal(2)]),
    weekdays: z.array(z.enum(DAYS_OF_WEEK)).min(1),
    end: todoRepeatEndSchema,
  }),
  z.object({
    frequency: z.literal('MONTHLY'),
    monthDay: z.int().min(1).max(31),
    end: todoRepeatEndSchema,
  }),
]);
export type TodoRepeat = z.infer<typeof todoRepeatSchema>;

const todoSeriesSchema = z.object({
  id: z.string(),
  repeat: todoRepeatSchema,
  startDate: z.iso.date(),
});
export type TodoSeries = z.infer<typeof todoSeriesSchema>;

export interface RepeatingTodoDraft {
  title: string;
  categoryId: number;
  startDate: string;
  scheduledTime?: string | null;
  isAllDay: boolean;
  visibility: 'PUBLIC' | 'PRIVATE';
  repeat: TodoRepeat;
}

export interface TodoSeriesEditOptions {
  /** 반복 회차를 고칠 때만. 단일 할 일에 보내면 서버가 TODO_0844로 거절한다 */
  scope?: TodoUpdateScope;
  /** 생략은 유지, 값은 규칙 변경·반복 전환, null은 이 회차 뒤로 끝내기 */
  repeat?: TodoRepeat | null;
  /** 앞으로 만들 회차에 복사할 체크리스트. 서버는 THIS_AND_FOLLOWING에서만 받는다 */
  checklist?: readonly { title: string }[];
}
