import type {
  ChangeTodoCategoryInput,
  CreateTodoInput,
  TodoSeriesResponse,
  UpdateTodoInput,
  UpdateTodoScheduleInput,
} from '@aido/api';

import type { TodoSeries } from '../domains/todo-series.model';
import type {
  RepeatingTodoDraft,
  TodoSeriesEditOptions,
} from '../schemas/todo-series-request.schema';
import { toRepeat, toRepeatDto } from './todo-repeat.mapper';

export function toTodoSeries(dto: TodoSeriesResponse): TodoSeries {
  return {
    id: dto.id,
    repeat: toRepeat(dto.repeat),
    startDate: dto.startDate,
  };
}

export function toCreateRepeatingTodoRequest(draft: RepeatingTodoDraft) {
  return {
    title: draft.title,
    categoryId: draft.categoryId,
    startDate: draft.startDate,
    scheduledTime: draft.isAllDay ? undefined : draft.scheduledTime,
    isAllDay: draft.isAllDay,
    visibility: draft.visibility,
    repeat: toRepeatDto(draft.repeat),
  } satisfies CreateTodoInput;
}

export function toUpdateTodoRequest(
  input: UpdateTodoInput,
  { scope, repeat, checklist }: TodoSeriesEditOptions,
): UpdateTodoInput {
  return {
    ...input,
    ...(scope != null && { scope }),
    // oxlint-disable-next-line aido/no-strict-nullish -- 생략은 규칙 유지, null은 이 회차 뒤로 끝내기다
    ...(repeat !== undefined && { repeat: repeat == null ? null : toRepeatDto(repeat) }),
    ...(checklist != null && { checklist: checklist.map(({ title }) => ({ title })) }),
  };
}

/** `/schedule`은 범위를 받지 않는다. 이후 회차까지 고칠 때는 PATCH로 시간만 보낸다(날짜는 이 회차에만 적용된다) */
export function toFollowingScheduleRequest({
  scheduledTime,
  isAllDay,
}: UpdateTodoScheduleInput): UpdateTodoInput {
  return { scheduledTime, isAllDay, scope: 'THIS_AND_FOLLOWING' } satisfies UpdateTodoInput;
}

/** `/category`는 범위를 받지 않는다. 이후 회차까지 옮길 때는 PATCH로 보낸다 */
export function toFollowingCategoryRequest({
  categoryId,
}: ChangeTodoCategoryInput): UpdateTodoInput {
  return { categoryId, scope: 'THIS_AND_FOLLOWING' } satisfies UpdateTodoInput;
}
