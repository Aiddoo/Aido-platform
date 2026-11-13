import type { TodoSeriesResponse, UpdateTodoInput } from '@aido/api';
import { dateKeySchema } from '@src/shared/date/date-key';

import type { TodoSeries } from '../domains/todo-series.model';
import type { TodoCategoryMove, TodoScheduleChange } from '../schemas/todo-request.schema';
import { toRepeat } from './todo-repeat.mapper';

export function toTodoSeries(dto: TodoSeriesResponse): TodoSeries {
  return {
    id: dto.id,
    repeat: toRepeat(dto.repeat),
    startDate: dateKeySchema.parse(dto.startDate),
  };
}

/** `/schedule`은 범위를 받지 않는다. 이후 회차까지 고칠 때는 PATCH로 시간만 보낸다(날짜는 이 회차에만 적용된다) */
export function toFollowingScheduleRequest({
  scheduledTime,
  isAllDay,
}: TodoScheduleChange): UpdateTodoInput {
  return { scheduledTime, isAllDay, scope: 'THIS_AND_FOLLOWING' } satisfies UpdateTodoInput;
}

/** `/category`는 범위를 받지 않는다. 이후 회차까지 옮길 때는 PATCH로 보낸다 */
export function toFollowingCategoryRequest({ categoryId }: TodoCategoryMove): UpdateTodoInput {
  return { categoryId, scope: 'THIS_AND_FOLLOWING' } satisfies UpdateTodoInput;
}
