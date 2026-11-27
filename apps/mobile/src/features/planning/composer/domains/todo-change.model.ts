import {
  TodoRepeatPolicy,
  todoRepeatSchema,
} from '@src/features/planning/todo/domains/todo-repeat.model';
import { TodoSchedulePolicy } from '@src/features/planning/todo/domains/todo-schedule.model';
import { todoEditableFieldsSchema } from '@src/features/planning/todo/domains/todo.model';
import { z } from 'zod';

// 수정 폼의 값. 저장된 할 일의 값과 고친 값을 같은 모양으로 비교한다
const todoEditValuesSchema = todoEditableFieldsSchema.extend({
  repeat: todoRepeatSchema.nullable(),
});
type TodoEditValues = z.infer<typeof todoEditValuesSchema>;

// 수정 폼에서 고친 것. 서버에 PATCH로 보내 생략과 null의 뜻이 다르다(docs/conventions/nullish.md)
const todoChangeSchema = z.object({
  /** 고친 칸만 담는다. 없는 칸은 서버가 그대로 두고 null은 비운다 */
  fields: todoEditableFieldsSchema.partial(),
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat: todoRepeatSchema.nullable().optional(),
});
export type TodoChange = z.infer<typeof todoChangeSchema>;

type TodoEditScopeDecision = 'no-scope' | 'this-only' | 'ask' | 'ask-following-only';

// 종일로 바꾸면 남아 있던 시각은 비운다
export function createTodoChange(edited: TodoEditValues, saved: TodoEditValues): TodoChange {
  return {
    fields: {
      ...(edited.title !== saved.title && { title: edited.title }),
      ...(edited.categoryId !== saved.categoryId && { categoryId: edited.categoryId }),
      ...(edited.startDate !== saved.startDate && { startDate: edited.startDate }),
      ...(edited.endDate !== saved.endDate && { endDate: edited.endDate }),
      ...(TodoSchedulePolicy.hasTimeChanged(edited, saved) && {
        scheduledTime: TodoSchedulePolicy.findScheduledTime(edited),
        isAllDay: edited.isAllDay,
      }),
      ...(edited.visibility !== saved.visibility && { visibility: edited.visibility }),
    },
    ...(!TodoRepeatPolicy.hasSameRepeat(edited.repeat, saved.repeat) && {
      repeat: edited.repeat,
    }),
  };
}

export const TodoChangePolicy = {
  hasTodoUpdateChanges(change: TodoChange): boolean {
    // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 변경이다
    return Object.keys(change.fields).length > 0 || change.repeat !== undefined;
  },

  // 날짜 이동은 범위와 상관없이 이 회차에만 적용되므로 범위를 묻지 않는다
  hasOnlyDateChanges(change: TodoChange): boolean {
    // oxlint-disable-next-line aido/no-strict-nullish -- repeat null도 날짜 밖의 변경이다
    if (change.repeat !== undefined) {
      return false;
    }
    const changed = Object.keys(change.fields);
    return (
      changed.length > 0 && changed.every((field) => field === 'startDate' || field === 'endDate')
    );
  },

  // 서버는 회차 규칙 변경을 THIS_AND_FOLLOWING으로만(TODO_0845), 끝내기는 범위 없이 받고 날짜 이동은 이 회차에만 적용한다
  getEditScopeDecision(change: TodoChange, isSeries: boolean): TodoEditScopeDecision {
    // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기, 생략은 규칙 유지다
    if (!isSeries || change.repeat === null) {
      return 'no-scope';
    }
    if (change.repeat != null) {
      return 'ask-following-only';
    }
    return this.hasOnlyDateChanges(change) ? 'this-only' : 'ask';
  },
};
