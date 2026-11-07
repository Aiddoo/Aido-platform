import {
  type ConvertMemoToTodosInput,
  convertMemoToTodosSchema,
  type CreateMemoInput,
  type Memo as MemoDto,
  type MemoListResponse,
  type MemoResourceLimitResponse,
  type ParseMemoResponse,
  type ParsedMemoTodo,
} from '@aido/api';
import type { AddTodoFormValues } from '@src/features/planning/composer/schemas/add-todo-form.schema';
import { toRepeat, toRepeatDto } from '@src/features/planning/todo/apis/todo-repeat.mapper';
import type { TodoRepeat } from '@src/features/planning/todo/schemas/todo-repeat.schema';
import {
  type PlannedAction,
  type VoicePlan,
  voicePlanSchema,
} from '@src/features/voice/schemas/voice-plan.schema';
import { diffDateKeysInDays } from '@src/shared/date/date-key';
import { toDateKey, toInstant } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { pick } from 'es-toolkit';

import type { MemoFormValues } from '../schemas/memo-form.schema';
import type { Memo, MemoPage, MemoResourceLimit } from '../schemas/memo.schema';

export function toMemo(dto: MemoDto): Memo {
  return {
    ...pick(dto, ['id', 'content', 'isPinned']),
    createdAt: toInstant(dto.createdAt),
    updatedAt: toInstant(dto.updatedAt),
  };
}

export function toMemoPage(dto: MemoListResponse): MemoPage {
  return {
    items: dto.items.map(toMemo),
    nextCursor: dto.pagination.nextCursor,
    hasNext: dto.pagination.hasNext,
  };
}

export function toMemoResourceLimit(dto: MemoResourceLimitResponse): MemoResourceLimit {
  return pick(dto, ['currentCount', 'maxPerUser']);
}

export function toMemoRequest({ content }: MemoFormValues): CreateMemoInput {
  return { content };
}

export function toConvertMemoToTodosRequest(values: AddTodoFormValues): ConvertMemoToTodosInput {
  const timeZone = getDeviceTimezone();

  return convertMemoToTodosSchema.parse({
    todos: [
      {
        title: values.title,
        categoryId: values.categoryId,
        startDate: toDateKey(values.startDate, timeZone),
        endDate: values.endDate == null ? undefined : toDateKey(values.endDate, timeZone),
        scheduledTime: values.isAllDay ? undefined : (values.scheduledTime ?? undefined),
        isAllDay: values.isAllDay,
        visibility: values.visibility,
        ...(values.repeat != null && { repeat: toRepeatDto(values.repeat) }),
      },
    ],
  });
}

/** 출시된 서버는 "이번 주말 X"를 토·일 + 그 주 일요일까지로 준다. 끝이 다음 날까지인 반복은 한 번으로 본다 */
function isSingleWeekend(repeat: TodoRepeat, startDate: string): boolean {
  return (
    repeat.frequency === 'WEEKLY' &&
    repeat.weekdays?.includes('SAT') === true &&
    repeat.weekdays.includes('SUN') &&
    repeat.end.type === 'UNTIL' &&
    diffDateKeysInDays(startDate, repeat.end.date) <= 1
  );
}

/** 1.15.0 서버는 `repeat`을 주고, 이전 서버는 요일+종료일(`recurrence`)만 준다 */
function toParsedMemoRepeat({ repeat, recurrence, startDate }: ParsedMemoTodo): TodoRepeat | null {
  const parsed: TodoRepeat | null =
    repeat != null
      ? toRepeat(repeat)
      : recurrence == null
        ? null
        : {
            frequency: 'WEEKLY',
            interval: 1,
            weekdays: recurrence.daysOfWeek,
            end: { type: 'UNTIL', date: recurrence.endDate },
          };
  return parsed != null && isSingleWeekend(parsed, startDate) ? null : parsed;
}

export function toVoicePlanFromParsedMemo(planId: string, dto: ParseMemoResponse): VoicePlan {
  const actions = dto.data.todos.map((todo, index): PlannedAction => ({
    type: 'create-todo',
    actionId: `memo-todo-${index}`,
    title: todo.title,
    startDate: todo.startDate,
    endDate: todo.repeat != null || todo.recurrence != null ? null : todo.endDate,
    scheduledTime: todo.isAllDay ? null : todo.scheduledTime,
    repeat: toParsedMemoRepeat(todo),
    visibility: null,
    items: todo.items,
    categoryId: todo.categoryId,
    // 1.15.0 이전 서버는 겹침을 판정하지 않는다
    duplicateOfTodoId: todo.duplicateOfTodoId ?? null,
  }));
  return voicePlanSchema.parse({
    planId,
    source: 'memo',
    sourceMemoId: null,
    actions,
    omittedTodoCount: dto.meta.omittedTodoCount ?? 0,
  });
}
