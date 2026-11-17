import { DAY_OF_WEEK_ORDER, dayIndexToDayOfWeek, type DayOfWeek } from "@aido/api/vocabulary";
import { groupBy, keyBy, mapValues, orderBy, range, sumBy } from "es-toolkit";

import { plainDateFromDate } from "#api/shared/domain/time/plain-date";

import {
  localDateAt,
  localDateTimeAt,
  sundayBasedDayIndex,
} from "../../shared/domain/user-calendar.domain-service.js";
import type {
  CategoryBreakdownItem,
  DailyCompletionItem,
  DayPatternItem,
  TimePatternItem,
} from "./ai-reports.constants.js";
import type {
  AggregationInputs,
  CategoryTodoGroup,
  ReportCategory,
  CompletedTodoTime,
  DailyTodoGroup,
  ReportAggregation,
} from "./ai-reports.constants.js";

function sumCountsBy<K extends PropertyKey>(
  groups: readonly DailyTodoGroup[],
  toKey: (group: DailyTodoGroup) => K,
): Partial<Record<K, number>> {
  return mapValues(groupBy(groups, toKey), (rows) => sumBy(rows, (row) => row._count.id));
}

/** 지운 카테고리의 집계에 쓰는 색. 이름은 리포트 언어에 맞게 호출자가 넘긴다 */
export const FALLBACK_CATEGORY_COLOR = "#808080";

const toDayOfWeek = (group: DailyTodoGroup): DayOfWeek =>
  dayIndexToDayOfWeek(sundayBasedDayIndex(plainDateFromDate(group.startDate)));

/** 전체·완료 할 일 수 묶음 */
interface TodoGroups<TGroup> {
  readonly total: readonly TGroup[];
  readonly completed: readonly TGroup[];
}

/** 집계하는 기간. 끝은 다음 기간 첫날의 시작이다 */
export interface AggregationRange {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly timezone: string;
}

/**
 * 카테고리별 집계 계산
 */
export function computeCategoryBreakdown(
  groups: TodoGroups<CategoryTodoGroup>,
  categories: readonly ReportCategory[],
  fallbackCategoryName: string,
): CategoryBreakdownItem[] {
  const { total: totalGroups, completed: completedGroups } = groups;
  const completedByCategoryId = keyBy(completedGroups, (g) => g.categoryId);
  const categoryById = keyBy(categories, (c) => c.id);

  const breakdown = totalGroups.map((g) => {
    const category = categoryById[g.categoryId];
    const total = g._count.id;
    const completed = completedByCategoryId[g.categoryId]?._count.id ?? 0;
    return {
      name: category?.name ?? fallbackCategoryName,
      color: category?.color ?? FALLBACK_CATEGORY_COLOR,
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
  totalGroups: DailyTodoGroup[],
  completedGroups: DailyTodoGroup[],
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
  completedTodos: CompletedTodoTime[],
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

export function computeDailyCompletions(params: {
  readonly totalGroups: readonly DailyTodoGroup[];
  readonly completedGroups: readonly DailyTodoGroup[];
  readonly period: { readonly firstDay: Temporal.PlainDate; readonly lastDay: Temporal.PlainDate };
}): DailyCompletionItem[] {
  const { totalGroups, completedGroups, period } = params;
  const toDateKey = (group: DailyTodoGroup) => plainDateFromDate(group.startDate).toString();
  const totalByDate = keyBy(totalGroups, toDateKey);
  const completedByDate = keyBy(completedGroups, toDateKey);
  const dayCount = period.firstDay.until(period.lastDay, { largestUnit: "days" }).days + 1;

  return range(dayCount).map((offset) => {
    const date = period.firstDay.add({ days: offset });
    return {
      date,
      total: totalByDate[date.toString()]?._count.id ?? 0,
      completed: completedByDate[date.toString()]?._count.id ?? 0,
    };
  });
}

/**
 * 연속 달성일 계산 (endDate부터 역순으로)
 *
 * 할 일이 0개인 날은 건너뜁니다 (streak을 끊지 않음).
 * 예: 주말에 할 일을 안 만들었다면 금-월 연속 달성이 가능합니다.
 * 할 일이 있었지만 하나라도 미완료라면 streak이 끊깁니다.
 */
export function computeStreakDays(
  groups: TodoGroups<DailyTodoGroup>,
  range: AggregationRange,
): number {
  const { total: totalGroups, completed: completedGroups } = groups;
  const { startDate, endDate, timezone } = range;
  const dateKeyOf = (group: DailyTodoGroup) => plainDateFromDate(group.startDate).toString();
  const totalByDate = sumCountsBy(totalGroups, dateKeyOf);
  const completedByDate = sumCountsBy(completedGroups, dateKeyOf);

  // endDate 전날부터 역순으로 연속 달성일 계산
  // DATE 그룹은 UTC 달력 label이고, 조회 경계만 사용자의 실제 instant다.
  const rangeStart = localDateAt(startDate, timezone);

  let streak = 0;
  let cursor = localDateAt(endDate, timezone).subtract({ days: 1 });
  while (Temporal.PlainDate.compare(cursor, rangeStart) >= 0) {
    const dateKey = cursor.toString();
    const total = totalByDate[dateKey] ?? 0;
    const completed = completedByDate[dateKey] ?? 0;

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
  range: AggregationRange,
  fallbackCategoryName: string,
): ReportAggregation {
  const { startDate, endDate, timezone } = range;
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
    { total: catTotalGroups, completed: catCompletedGroups },
    categories,
    fallbackCategoryName,
  );

  const dayPatterns = computeDayPatterns(dailyTotalGroups, dailyCompletedGroups);

  const timePatterns = computeTimePatterns(completedTodos, timezone);

  const streakDays = computeStreakDays(
    { total: dailyTotalGroups, completed: dailyCompletedGroups },
    range,
  );

  const dailyCompletions = computeDailyCompletions({
    totalGroups: dailyTotalGroups,
    completedGroups: dailyCompletedGroups,
    period: {
      firstDay: localDateAt(startDate, timezone),
      lastDay: localDateAt(endDate, timezone).subtract({ days: 1 }),
    },
  });

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
    dailyCompletions,
    hasActivity,
  };
}
