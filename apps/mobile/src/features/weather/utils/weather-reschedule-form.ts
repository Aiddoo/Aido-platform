import { toInstant } from '@src/shared/date/instant';

import type { ScheduleChange } from '../domains/weather-reschedule.model';
import type { WeatherRescheduleFormValues } from '../schemas/weather-reschedule-form.schema';

/** react-hook-form은 숫자 경로를 배열 index로 읽어 selections를 배열로 만들므로 숫자만으로 된 키를 쓰지 않는다 */
export function toSelectionKey(todoId: number): string {
  return `todo-${todoId}`;
}

/** 시트에 남아 있는 할 일만 옮긴다. 목록에서 뺀 할 일의 이전 선택은 무시한다. */
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
