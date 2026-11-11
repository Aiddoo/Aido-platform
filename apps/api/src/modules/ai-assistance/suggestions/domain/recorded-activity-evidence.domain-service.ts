import { DAY_OF_WEEK_ORDER, type DayOfWeek, dayIndexToDayOfWeek } from "@aido/api/vocabulary";
import { groupBy, isNotNil, orderBy, uniq } from "es-toolkit";

import { sundayBasedDayIndex } from "../../shared/domain/user-calendar.domain-service.js";
import type { RecordedActivityEvidence, TodoSummaryForAnalysis } from "./suggestion.constants.js";

export function collectRecordedActivities(
  todos: readonly TodoSummaryForAnalysis[],
): RecordedActivityEvidence[] {
  return Object.entries(groupBy(todos, (todo) => todo.title)).map(([title, records]) => {
    const recordsByDay: Partial<Record<DayOfWeek, TodoSummaryForAnalysis[]>> = groupBy(
      records,
      (record) =>
        dayIndexToDayOfWeek(sundayBasedDayIndex(Temporal.PlainDate.from(record.startDate))),
    );
    return {
      title,
      occurrences: records.length,
      completedOccurrences: countCompleted(records),
      days: DAY_OF_WEEK_ORDER.flatMap((day) => {
        const dayRecords = recordsByDay[day];
        return dayRecords == null
          ? []
          : [{ day, total: dayRecords.length, completed: countCompleted(dayRecords) }];
      }),
      recordedTimes: uniq(records.map((record) => record.scheduledTime).filter(isNotNil)).sort(),
    };
  });
}

function countCompleted(records: readonly TodoSummaryForAnalysis[]): number {
  return records.filter((record) => record.completed).length;
}

/** 반복된 성공 요일을 우선하고, 없으면 완료 수→기록 수→ISO 요일 순으로 한 요일을 고른다. */
export function selectRecordedDays(evidence: RecordedActivityEvidence) {
  const repeatedSuccessfulDays = evidence.days.filter((day) => day.total >= 2 && day.completed > 0);
  if (repeatedSuccessfulDays.length > 0) {
    return repeatedSuccessfulDays.map((day) => day.day);
  }
  const bestDay = orderBy(
    evidence.days,
    ["completed", "total", (day) => DAY_OF_WEEK_ORDER.indexOf(day.day)],
    ["desc", "desc", "asc"],
  )[0];
  return bestDay == null ? [] : [bestDay.day];
}
