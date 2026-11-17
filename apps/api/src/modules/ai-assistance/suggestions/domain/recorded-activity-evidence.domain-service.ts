import { DAY_OF_WEEK_ORDER, type DayOfWeek, dayIndexToDayOfWeek } from "@aido/api/vocabulary";
import { countBy, groupBy, maxBy, orderBy } from "es-toolkit";

import { sundayBasedDayIndex } from "../../shared/domain/user-calendar.domain-service.js";
import type { RecordedActivityEvidence, TodoSummaryForAnalysis } from "./suggestions.constants.js";

const IGNORED_TITLE_CHARACTERS =
  /[\p{P}\p{S}\p{Extended_Pictographic}\p{Cf}\p{Me}\p{Variation_Selector}\s]/gu;
// NFKC가 호환 자모(ㅋ)를 조합용 자모(ᄏ)로 바꾸므로 조합용 자모 범위를 뺀다
const HANGUL_JAMO = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/gu;
const MIN_TITLE_LETTERS = 2;

export function toActivityKey(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(IGNORED_TITLE_CHARACTERS, "");
}

export function isMeaningfulTitle(title: string): boolean {
  const letters = toActivityKey(title).replace(HANGUL_JAMO, "").match(/\p{L}/gu) ?? [];
  return letters.length >= MIN_TITLE_LETTERS;
}

export function collectRecordedActivities(
  todos: readonly TodoSummaryForAnalysis[],
): RecordedActivityEvidence[] {
  const meaningful = todos.filter((todo) => isMeaningfulTitle(todo.title));
  return Object.entries(groupBy(meaningful, (todo) => toActivityKey(todo.title))).map(
    ([key, records]) => {
      const recordsByDay: Partial<Record<DayOfWeek, TodoSummaryForAnalysis[]>> = groupBy(
        records,
        (record) =>
          dayIndexToDayOfWeek(sundayBasedDayIndex(Temporal.PlainDate.from(record.startDate))),
      );
      const topTime = findMostUsed(records.flatMap(({ scheduledTime }) => scheduledTime ?? []));
      return {
        key,
        title: findMostUsed(records.map((record) => record.title))?.value ?? key,
        occurrences: records.length,
        completedOccurrences: countCompleted(records),
        days: DAY_OF_WEEK_ORDER.flatMap((day) => {
          const dayRecords = recordsByDay[day];
          return dayRecords == null
            ? []
            : [{ day, total: dayRecords.length, completed: countCompleted(dayRecords) }];
        }),
        recordedTime: topTime != null && topTime.count >= 2 ? topTime.value : null,
        categoryName: records[0]?.categoryName ?? "",
      };
    },
  );
}

// 횟수가 같으면 먼저 기록한 값이다
function findMostUsed(values: readonly string[]): { value: string; count: number } | null {
  const top = maxBy(Object.entries(countBy(values, (value) => value)), ([, count]) => count);
  return top == null ? null : { value: top[0], count: top[1] };
}

function countCompleted(records: readonly TodoSummaryForAnalysis[]): number {
  return records.filter((record) => record.completed).length;
}

/** 반복된 성공 요일을 우선하고, 없으면 완료 수→기록 수→ISO 요일 순으로 한 요일을 고른다. */
export function selectRecordedDays(evidence: Pick<RecordedActivityEvidence, "days">) {
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
