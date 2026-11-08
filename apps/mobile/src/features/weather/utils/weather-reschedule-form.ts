import { toInstant } from '@src/shared/date/instant';

import type { ScheduleChange } from '../domains/weather-reschedule.model';
import type { WeatherRescheduleFormValues } from '../schemas/weather-reschedule-form.schema';

/** 폼 필드 이름(`selections.<키>`)에 쓰는 할 일 키 */
export function toSelectionKey(todoId: number): string {
  return `todo-${todoId}`;
}

export function toScheduleChanges(
  { selections }: WeatherRescheduleFormValues,
  todoIds: readonly number[],
): ScheduleChange[] {
  return todoIds.flatMap((todoId) => {
    const selection = selections[toSelectionKey(todoId)];
    return selection == null ? [] : [{ todoId, startsAt: toInstant(selection) }];
  });
}

/** 일괄 변경 결과. 성공한 할 일만 모으고, 실패는 이유만 모아 한 번에 알린다. */
export function toRescheduleOutcome<TTodo>(
  targets: readonly { todo: TTodo }[],
  results: readonly PromiseSettledResult<unknown>[],
): { moved: TTodo[]; failures: unknown[] } {
  return {
    moved: targets.flatMap(({ todo }, index) =>
      results[index]?.status === 'fulfilled' ? [todo] : [],
    ),
    failures: results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : [])),
  };
}
