import {
  type ConvertMemoToTodosInput,
  convertMemoToTodosSchema,
  type CreateMemoInput,
  type Memo as MemoDto,
  type MemoListResponse,
  type MemoResourceLimitResponse,
} from '@aido/api';
import type { AddTodoFormValues } from '@src/features/planning/composer/schemas/add-todo-form.schema';
import { toRepeat, toRepeatDto } from '@src/features/planning/todo/apis/todo-repeat.mapper';
import {
  type PlannedAction,
  type VoicePlan,
  voicePlanSchema,
} from '@src/features/voice/domains/voice-plan.model';
import { toDateKey, toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { Memo, MemoPage, MemoResourceLimit } from '../domains/memo.model';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import type { ParseMemoPlanResponse } from '../schemas/memo-plan-response.schema';

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

export function toConvertMemoToTodosRequest(
  values: AddTodoFormValues,
  timeZone: string,
): ConvertMemoToTodosInput {
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

export function toMemoVoicePlan(planId: string, dto: ParseMemoPlanResponse): VoicePlan {
  const actions = dto.data.todos.map((todo, index): PlannedAction => ({
    type: 'create-todo',
    actionId: `memo-todo-${index}`,
    title: todo.title,
    startDate: todo.startDate,
    endDate: todo.repeat != null ? null : todo.endDate,
    scheduledTime: todo.isAllDay ? null : todo.scheduledTime,
    repeat: todo.repeat == null ? null : toRepeat(todo.repeat),
    visibility: null,
    items: todo.items,
    categoryId: todo.categoryId,
    duplicateOfTodoId: todo.duplicateOfTodoId,
  }));
  return voicePlanSchema.parse({
    planId,
    source: 'memo',
    sourceMemoId: null,
    actions,
    omittedTodoCount: dto.meta.omittedTodoCount,
  });
}
