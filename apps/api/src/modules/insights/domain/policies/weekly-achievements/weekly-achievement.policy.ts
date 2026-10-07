import { ErrorCode } from "@aido/api/errors";
import dayjs from "dayjs";
import isLeapYear from "dayjs/plugin/isLeapYear.js";
import isoWeek from "dayjs/plugin/isoWeek.js";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear.js";
import { sumBy } from "es-toolkit";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import type {
  StreakResult,
  WeeklyAchievementRecord,
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
  WeeklyAchievementSummary,
} from "../../records/weekly-achievements/weekly-achievement.record.js";

dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);

/**
 * ISO year + week → 해당 주의 기준일(dayjs 인스턴스)을 반환합니다.
 *
 * `isoWeekYear()` 는 getter 전용이므로, Jan 4(항상 ISO week 1에 포함)를
 * 기준점으로 삼아 `.isoWeek(week)` setter 로 목표 주차를 설정합니다.
 */
function dayjsFromIsoWeek(year: number, week: number): dayjs.Dayjs {
  return dayjs(`${year}-01-04`).isoWeek(week);
}

export function completionRateOf(totalTodos: number, completedTodos: number): number {
  return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
}

/**
 * ISO 주차의 시작일(월요일)과 종료일(일요일)을 계산합니다.
 *
 * @example computeDateRange(2026, 10) // { startDate: "2026-03-02", endDate: "2026-03-08" }
 */
export function computeDateRange(
  year: number,
  week: number,
): { startDate: string; endDate: string } {
  const monday = dayjsFromIsoWeek(year, week).isoWeekday(1).startOf("day");
  const sunday = monday.add(6, "day");

  return {
    startDate: monday.format("YYYY-MM-DD"),
    endDate: sunday.format("YYYY-MM-DD"),
  };
}

function isConsecutiveWeek(prev: WeeklyAchievementRecord, curr: WeeklyAchievementRecord): boolean {
  if (prev.year === curr.year && curr.week === prev.week + 1) {
    return true;
  }

  if (curr.year === prev.year + 1 && curr.week === 1) {
    const maxWeeks = dayjsFromIsoWeek(prev.year, 1).isoWeeksInYear();
    return prev.week === maxWeeks;
  }

  return false;
}

/**
 * 연속 달성 주차(streak)를 계산합니다.
 * 연말→연초 경계(예: 53주→1주)도 처리합니다.
 *
 * @param records - year/week 오름차순 정렬된 기록 배열
 * @returns currentStreak (최신 주차부터 거슬러 올라간 연속 수), bestStreak (최고 연속)
 */
export function computeStreak(records: readonly WeeklyAchievementRecord[]): StreakResult {
  if (records.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let streak = 1;

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    if (prev !== undefined && curr !== undefined && isConsecutiveWeek(prev, curr)) {
      streak++;
    } else {
      streak = 1;
    }

    if (streak > bestStreak) {
      bestStreak = streak;
    }
  }

  return { currentStreak: streak, bestStreak };
}

export function computeSummary(rows: readonly WeeklyAchievementRow[]): WeeklyAchievementSummary {
  const totalWeeks = rows.length;

  if (totalWeeks === 0) {
    return {
      totalWeeks: 0,
      perfectWeeks: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageRate: 0,
    };
  }

  const perfectWeeks = rows.filter(
    (row) => row.totalTodos > 0 && row.completedTodos === row.totalTodos,
  ).length;

  const averageRate = Math.round(
    sumBy(rows, (row) => completionRateOf(row.totalTodos, row.completedTodos)) / totalWeeks,
  );

  const records: readonly WeeklyAchievementRecord[] = rows
    .map((row) => ({ year: row.year, week: row.week }))
    .sort((a, b) => a.year - b.year || a.week - b.week);

  const { currentStreak, bestStreak } = computeStreak(records);

  return { totalWeeks, perfectWeeks, currentStreak, bestStreak, averageRate };
}

/**
 * upsert 입력의 도메인 불변식을 검증한 스냅샷을 반환합니다.
 *
 * 불변식: 완료 수는 0 이상이며 전체 수를 초과할 수 없고, 주차는 ISO 범위(1-53)여야 합니다.
 * 위반 시 DomainException(SYS_0002).
 */
export function buildWeeklyAchievementSnapshot(
  input: WeeklyAchievementUpsert,
): WeeklyAchievementUpsert {
  if (input.totalTodos < 0) {
    throw new DomainException(ErrorCode.SYS_0002, {
      field: "totalTodos",
      value: input.totalTodos,
    });
  }
  if (input.completedTodos < 0 || input.completedTodos > input.totalTodos) {
    throw new DomainException(ErrorCode.SYS_0002, {
      field: "completedTodos",
      completedTodos: input.completedTodos,
      totalTodos: input.totalTodos,
    });
  }
  if (input.week < 1 || input.week > 53) {
    throw new DomainException(ErrorCode.SYS_0002, {
      field: "week",
      value: input.week,
    });
  }

  return { ...input, achievedAt: new Date(input.achievedAt) };
}
