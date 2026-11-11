import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek, type DayOfWeek } from "@aido/api/vocabulary";
import { groupBy, keyBy, mapValues, orderBy, sumBy } from "es-toolkit";

import { plainDateFromDate } from "#api/shared/domain/time/plain-date";

import {
  localDateAt,
  localDateTimeAt,
  sundayBasedDayIndex,
} from "../../shared/domain/user-calendar.domain-service.js";
import type {
  CategoryBreakdownItem,
  DayPatternItem,
  TimePatternItem,
} from "./ai-report.constants.js";
import type {
  AggregatedReportData,
  AggregationInputs,
  CategoryGroupRow,
  CategoryMetaRow,
  CompletedTodoRow,
  DailyGroupRow,
} from "./ai-report.constants.js";

function sumCountsBy<K extends PropertyKey>(
  groups: readonly DailyGroupRow[],
  toKey: (group: DailyGroupRow) => K,
): Partial<Record<K, number>> {
  return mapValues(groupBy(groups, toKey), (rows) => sumBy(rows, (row) => row._count.id));
}

const toDayOfWeek = (group: DailyGroupRow): DayOfWeek =>
  dayIndexToDayOfWeek(sundayBasedDayIndex(plainDateFromDate(group.startDate)));

/**
 * 카테고리별 집계 계산
 */
export function computeCategoryBreakdown(
  totalGroups: CategoryGroupRow[],
  completedGroups: CategoryGroupRow[],
  categories: CategoryMetaRow[],
): CategoryBreakdownItem[] {
  const completedByCategoryId = keyBy(completedGroups, (g) => g.categoryId);
  const categoryById = keyBy(categories, (c) => c.id);

  const breakdown = totalGroups.map((g) => {
    const category = categoryById[g.categoryId];
    const total = g._count.id;
    const completed = completedByCategoryId[g.categoryId]?._count.id ?? 0;
    return {
      name: category?.name ?? "기타",
      color: category?.color ?? "#808080",
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return orderBy(breakdown, ["total"], ["desc"]);
}

/**
 * 요일별 패턴 계산
 */
export function computeDayPatterns(
  totalGroups: DailyGroupRow[],
  completedGroups: DailyGroupRow[],
): DayPatternItem[] {
  const totalByDay = sumCountsBy(totalGroups, toDayOfWeek);
  const completedByDay = sumCountsBy(completedGroups, toDayOfWeek);

  return DAY_OF_WEEK_ORDER.map((day) => {
    const total = totalByDay[day] ?? 0;
    const completed = completedByDay[day] ?? 0;
    return {
      day,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
}

/**
 * 시간대별 패턴 계산
 */
export function computeTimePatterns(
  completedTodos: CompletedTodoRow[],
  timezone: string,
): TimePatternItem[] {
  const hourCounts = new Map<number, number>();

  for (const todo of completedTodos) {
    if (todo.completedAt != null) {
      const { hour } = localDateTimeAt(todo.completedAt, timezone);
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
  }

  // 활동이 있는 시간대만 반환
  return Array.from(hourCounts.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 연속 달성일 계산 (endDate부터 역순으로)
 *
 * 할 일이 0개인 날은 건너뜁니다 (streak을 끊지 않음).
 * 예: 주말에 할 일을 안 만들었다면 금-월 연속 달성이 가능합니다.
 * 할 일이 있었지만 하나라도 미완료라면 streak이 끊깁니다.
 */
export function computeStreakDays(
  totalGroups: DailyGroupRow[],
  completedGroups: DailyGroupRow[],
  startDate: Date,
  endDate: Date,
  timezone: string,
): number {
  const dateKeyOf = (group: DailyGroupRow) => plainDateFromDate(group.startDate).toString();
  const totalByDate = sumCountsBy(totalGroups, dateKeyOf);
  const completedByDate = sumCountsBy(completedGroups, dateKeyOf);

  // endDate 전날부터 역순으로 연속 달성일 계산
  // DATE 그룹은 UTC 달력 label이고, 조회 경계만 사용자의 실제 instant다.
  const rangeStart = localDateAt(startDate, timezone);

  let streak = 0;
  let cursor = localDateAt(endDate, timezone).subtract({ days: 1 });
  while (Temporal.PlainDate.compare(cursor, rangeStart) >= 0) {
    const dateStr = cursor.toString();
    const total = totalByDate[dateStr] ?? 0;
    const completed = completedByDate[dateStr] ?? 0;

    if (total === 0) {
      // 할 일이 없는 날은 건너뛰기
      cursor = cursor.subtract({ days: 1 });
      continue;
    }

    if (completed === total) {
      streak++;
      cursor = cursor.subtract({ days: 1 });
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 집계 원시 데이터를 리포트 통계로 조립한다.
 *
 * 저장소가 조회한 그룹 집계를 받아 요일/시간대/카테고리/연속일 패턴을 계산한다.
 */
export function assembleAggregatedData(
  inputs: AggregationInputs,
  startDate: Date,
  endDate: Date,
  timezone: string,
): AggregatedReportData {
  const {
    dailyTotalGroups,
    dailyCompletedGroups,
    prevTotalCount,
    prevCompletedCount,
    catTotalGroups,
    catCompletedGroups,
    categories,
    completedTodos,
  } = inputs;

  // 전체/완료 계산
  const totalTodos = sumBy(dailyTotalGroups, (g) => g._count.id);
  const completedTodosCount = sumBy(dailyCompletedGroups, (g) => g._count.id);
  const completionRate = totalTodos > 0 ? Math.round((completedTodosCount / totalTodos) * 100) : 0;

  // 이전 기간 달성률
  const prevCompletionRate =
    prevTotalCount > 0 ? Math.round((prevCompletedCount / prevTotalCount) * 100) : null;

  const categoryBreakdown = computeCategoryBreakdown(
    catTotalGroups,
    catCompletedGroups,
    categories,
  );

  const dayPatterns = computeDayPatterns(dailyTotalGroups, dailyCompletedGroups);

  const timePatterns = computeTimePatterns(completedTodos, timezone);

  const streakDays = computeStreakDays(
    dailyTotalGroups,
    dailyCompletedGroups,
    startDate,
    endDate,
    timezone,
  );

  const hasActivity = totalTodos > 0;

  return {
    totalTodos,
    completedTodos: completedTodosCount,
    completionRate,
    prevCompletionRate,
    streakDays,
    categoryBreakdown,
    dayPatterns,
    timePatterns,
    hasActivity,
  };
}
