import {
  type ConvertMemoToTodosInput,
  convertMemoToTodosSchema,
  type CreateMemoInput,
  type Memo as MemoDto,
  type MemoListResponse,
  type MemoResourceLimitResponse,
} from '@aido/api';
import type { AddTodoFormValues } from '@src/features/planning/composer/domains/add-todo-form.schema';
import { toRepeatDto } from '@src/features/planning/todo/apis/todo-series.mapper';
import { toDateKey } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { pick } from 'es-toolkit';

import type { MemoFormValues } from '../schemas/memo-form.schema';
import type { Memo, MemoPage, MemoResourceLimit } from '../schemas/memo.schema';

export function toMemo(dto: MemoDto): Memo {
  return {
    ...pick(dto, ['id', 'content', 'isPinned']),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
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
