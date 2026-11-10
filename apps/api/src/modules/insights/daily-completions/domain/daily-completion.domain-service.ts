import { uniq } from "es-toolkit";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { DailyCompletion } from "./daily-completion.entity.js";
import type { DateRange } from "./date-range.vo.js";

/** 같은 날짜·완료 여부·카테고리 색으로 묶은 할 일 수 */
export interface TodoCompletionGroup {
  readonly startDate: Temporal.PlainDate;
  readonly completed: boolean;
  readonly categoryColor: string | null;
  readonly todoCount: number;
}

interface DayTally {
  readonly date: Temporal.PlainDate;
  totalTodos: number;
  completedTodos: number;
  readonly categoryColors: string[];
}

function daysCounted(group: TodoCompletionGroup, range: DateRange): Temporal.PlainDate[] {
  return range.includes(group.startDate) ? [group.startDate] : [];
}

/** 조회 구간의 날짜별 완료 현황(날짜 오름차순). 할 일이 없는 날은 넣지 않는다. */
export function tallyDailyCompletions(params: {
  readonly userId: UserId;
  readonly range: DateRange;
  readonly groups: readonly TodoCompletionGroup[];
}): DailyCompletion[] {
  const tallies = new Map<string, DayTally>();
  for (const group of params.groups) {
    for (const date of daysCounted(group, params.range)) {
      const key = date.toString();
      const tally = tallies.get(key) ?? {
        date,
        totalTodos: 0,
        completedTodos: 0,
        categoryColors: [],
      };
      tally.totalTodos += group.todoCount;
      tally.completedTodos += group.completed ? group.todoCount : 0;
      if (group.categoryColor != null) {
        tally.categoryColors.push(group.categoryColor);
      }
      tallies.set(key, tally);
    }
  }
  return [...tallies.values()]
    .toSorted((left, right) => Temporal.PlainDate.compare(left.date, right.date))
    .map((tally) =>
      DailyCompletion.create({
        userId: params.userId,
        date: tally.date,
        totalTodos: tally.totalTodos,
        completedTodos: tally.completedTodos,
        // 조회 행 순서는 보장되지 않는다. 앱의 정렬(uniq 후 문자열 오름차순)과 같은 순서로 내려준다
        categoryColors: uniq(tally.categoryColors).toSorted(),
      }),
    );
}

/** 할 일을 모두 끝낸 날 수(달력의 물고기 개수) */
export function countCompleteDays(completions: readonly DailyCompletion[]): number {
  return completions.filter((completion) => completion.isComplete).length;
}
