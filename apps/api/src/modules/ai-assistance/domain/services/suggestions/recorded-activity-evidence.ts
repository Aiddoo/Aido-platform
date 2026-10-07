import { DAY_OF_WEEK_ORDER, type DayOfWeek, dayIndexToDayOfWeek } from "@aido/api/vocabulary";
import dayjs from "dayjs";
import { groupBy } from "es-toolkit";

import type {
  RecordedActivityEvidence,
  TodoSummaryForAnalysis,
} from "../../types/suggestions/ai-suggestion.types.js";

export function collectRecordedActivities(
  todos: readonly TodoSummaryForAnalysis[],
): RecordedActivityEvidence[] {
  return Object.entries(groupBy(todos, (todo) => todo.title)).map(([title, records]) => {
    const days = new Map<DayOfWeek, { total: number; completed: number }>();
    const recordedTimes = new Set<string>();
    let completedOccurrences = 0;
    for (const record of records) {
      const day = dayIndexToDayOfWeek(dayjs.utc(record.startDate).day());
      const counts = days.get(day) ?? { total: 0, completed: 0 };
      counts.total += 1;
      if (record.completed) {
        counts.completed += 1;
        completedOccurrences += 1;
      }
      days.set(day, counts);
      if (record.scheduledTime !== null) {
        recordedTimes.add(record.scheduledTime);
      }
    }
    return {
      title,
      occurrences: records.length,
      completedOccurrences,
      days: DAY_OF_WEEK_ORDER.flatMap((day) => {
        const counts = days.get(day);
        return counts === undefined ? [] : [{ day, ...counts }];
      }),
      recordedTimes: [...recordedTimes].sort(),
    };
  });
}

/** 반복된 성공 요일을 우선하고, 없으면 완료 수→기록 수→ISO 요일 순으로 한 요일을 고른다. */
export function selectRecordedDays(evidence: RecordedActivityEvidence) {
  const repeatedSuccessfulDays = evidence.days.filter((day) => day.total >= 2 && day.completed > 0);
  if (repeatedSuccessfulDays.length > 0) {
    return repeatedSuccessfulDays.map((day) => day.day);
  }
  const bestDay = [...evidence.days].sort(
    (left, right) =>
      right.completed - left.completed ||
      right.total - left.total ||
      DAY_OF_WEEK_ORDER.indexOf(left.day) - DAY_OF_WEEK_ORDER.indexOf(right.day),
  )[0];
  return bestDay === undefined ? [] : [bestDay.day];
}
