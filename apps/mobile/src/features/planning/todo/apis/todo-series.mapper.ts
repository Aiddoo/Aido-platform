import type {
  ChangeTodoCategoryInput,
  CreateTodoInput,
  TodoRepeat as TodoRepeatDto,
  TodoRepeatEnd as TodoRepeatEndDto,
  TodoSeriesResponse,
  UpdateTodoInput,
  UpdateTodoScheduleInput,
} from '@aido/api';
import { match } from 'ts-pattern';

import type {
  TodoRepeat,
  TodoRepeatEnd,
  TodoSeries,
  TodoUpdateScope,
} from '../schemas/todo-repeat.schema';

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

function toRepeatEnd(end: TodoRepeatEndDto): TodoRepeatEnd {
  return match(end)
    .returnType<TodoRepeatEnd>()
    .with({ type: 'NEVER' }, () => ({ type: 'NEVER' }))
    .with({ type: 'UNTIL' }, ({ date }) => ({ type: 'UNTIL', date }))
    .with({ type: 'COUNT' }, ({ count }) => ({ type: 'COUNT', count }))
    .exhaustive();
}

export function toRepeat(dto: TodoRepeatDto): TodoRepeat {
  return match(dto)
    .returnType<TodoRepeat>()
    .with({ frequency: 'DAILY' }, ({ end }) => ({ frequency: 'DAILY', end: toRepeatEnd(end) }))
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays, end }) => ({
      frequency: 'WEEKLY',
      interval,
      weekdays: [...weekdays],
      end: toRepeatEnd(end),
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay, end }) => ({
      frequency: 'MONTHLY',
      monthDay,
      end: toRepeatEnd(end),
    }))
    .exhaustive();
}

function toRepeatEndDto(end: TodoRepeatEnd): TodoRepeatEndDto {
  return match(end)
    .returnType<TodoRepeatEndDto>()
    .with({ type: 'NEVER' }, () => ({ type: 'NEVER' }))
    .with({ type: 'UNTIL' }, ({ date }) => ({ type: 'UNTIL', date }))
    .with({ type: 'COUNT' }, ({ count }) => ({ type: 'COUNT', count }))
    .exhaustive();
}

export function toRepeatDto(repeat: TodoRepeat): TodoRepeatDto {
  return match(repeat)
    .returnType<TodoRepeatDto>()
    .with({ frequency: 'DAILY' }, ({ end }) => ({ frequency: 'DAILY', end: toRepeatEndDto(end) }))
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays, end }) => ({
      frequency: 'WEEKLY',
      interval,
      weekdays: [...weekdays],
      end: toRepeatEndDto(end),
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay, end }) => ({
      frequency: 'MONTHLY',
      monthDay,
      end: toRepeatEndDto(end),
    }))
    .exhaustive();
}

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
    // nullish-strict: 생략은 규칙 유지, null은 이 회차 뒤로 끝내기다
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
