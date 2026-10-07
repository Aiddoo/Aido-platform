import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek, type DayOfWeek } from "@aido/api/vocabulary";
import dayjs from "dayjs";

import { toDateString } from "#api/shared/domain/date/utils/format";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  CategoryBreakdownItem,
  DayPatternItem,
  TimePatternItem,
} from "../../types/reports/ai-report.types.js";
import type {
  AggregatedReportData,
  AggregationInputs,
  CategoryGroupRow,
  CategoryMetaRow,
  CompletedTodoRow,
  DailyGroupRow,
} from "../../types/reports/ai-report.types.js";

/**
 * 카테고리별 집계 계산
 */
export function computeCategoryBreakdown(
  totalGroups: CategoryGroupRow[],
  completedGroups: CategoryGroupRow[],
  categories: CategoryMetaRow[],
): CategoryBreakdownItem[] {
  const completedMap = new Map(completedGroups.map((g) => [g.categoryId, g._count.id]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return totalGroups
    .map((g) => {
      const category = categoryMap.get(g.categoryId);
      const total = g._count.id;
      const completed = completedMap.get(g.categoryId) ?? 0;
      return {
        name: category?.name ?? "기타",
        color: category?.color ?? "#808080",
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * 요일별 패턴 계산
 */
export function computeDayPatterns(
  totalGroups: DailyGroupRow[],
  completedGroups: DailyGroupRow[],
): DayPatternItem[] {
  const dayTotals = new Map<DayOfWeek, number>();
  const dayCompleted = new Map<DayOfWeek, number>();

  for (const g of totalGroups) {
    const day = dayIndexToDayOfWeek(dayjs.utc(g.startDate).day());
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + g._count.id);
  }

  for (const g of completedGroups) {
    const day = dayIndexToDayOfWeek(dayjs.utc(g.startDate).day());
    dayCompleted.set(day, (dayCompleted.get(day) ?? 0) + g._count.id);
  }

  return DAY_OF_WEEK_ORDER.map((day) => {
    const total = dayTotals.get(day) ?? 0;
    const completed = dayCompleted.get(day) ?? 0;
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
    if (todo.completedAt !== null) {
      const hour = dayjs(todo.completedAt).tz(timezone).hour();
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
  // 날짜별 전체/완료 맵 생성
  const totalByDate = new Map<string, number>();
  const completedByDate = new Map<string, number>();

  for (const g of totalGroups) {
    const dateStr = toDateString(g.startDate);
    totalByDate.set(dateStr, (totalByDate.get(dateStr) ?? 0) + g._count.id);
  }
  for (const g of completedGroups) {
    const dateStr = toDateString(g.startDate);
    completedByDate.set(dateStr, (completedByDate.get(dateStr) ?? 0) + g._count.id);
  }

  // endDate 전날부터 역순으로 연속 달성일 계산
  // DATE 그룹은 UTC 달력 label이고, 조회 경계만 사용자의 실제 instant다.
  const current = dayjs.utc(startOfDayInTimezone(endDate, timezone)).subtract(1, "day");
  const rangeStart = dayjs.utc(startOfDayInTimezone(startDate, timezone));

  let streak = 0;
  let cursor = current;
  while (cursor.isAfter(rangeStart, "day") || cursor.isSame(rangeStart, "day")) {
    const dateStr = cursor.format("YYYY-MM-DD");
    const total = totalByDate.get(dateStr) ?? 0;
    const completed = completedByDate.get(dateStr) ?? 0;

    if (total === 0) {
      // 할 일이 없는 날은 건너뛰기
      cursor = cursor.subtract(1, "day");
      continue;
    }

    if (completed === total) {
      streak++;
      cursor = cursor.subtract(1, "day");
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
  const totalTodos = dailyTotalGroups.reduce((sum, g) => sum + g._count.id, 0);
  const completedTodosCount = dailyCompletedGroups.reduce((sum, g) => sum + g._count.id, 0);
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
