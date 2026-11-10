import {
  AI_SUGGESTION_LIMITS,
  DAY_OF_WEEK_ORDER,
  type DayOfWeek,
  dayIndexToDayOfWeek,
} from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { compact, countBy, groupBy, sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  dateColumnOf,
  localDateAt,
  localDateTimeAt,
  plainDateOfDateColumn,
  sundayBasedDayIndex,
} from "../../../shared/domain/user-calendar.domain-service.js";
import { SuggestionActivityReaderPort } from "../../application/ports/suggestion-activity.reader.port.js";
import type {
  CategoryCompletionRate,
  DayCompletionRate,
  SuggestionHistoryItem,
  TimeCompletionRate,
  TodoSummaryForAnalysis,
  UserStreakInfo,
} from "../../domain/suggestion.constants.js";

// planning Todo.startDate는 아직 UTC 자정 Date로 읽는 달력 날짜다
function localDay(value: Date, timezone: string): Date {
  return dateColumnOf(localDateAt(value, timezone));
}

function toWallClock(local: Temporal.ZonedDateTime): string {
  return local.toPlainTime().toString({ smallestUnit: "minute" });
}

/** 제안 분석용 활동 projection. planning·insights 테이블을 읽는다(공개 조회 포트로 옮기는 것은 후속). */
@Injectable()
export class DrizzleSuggestionActivityReader extends SuggestionActivityReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findDayCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<DayCompletionRate[]> {
    const completions = await this.#db.query.dailyCompletion.findMany({
      columns: { date: true, totalTodos: true, completedTodos: true },
      where: {
        userId,
        date: { gte: localDateAt(from, timezone), lte: localDateAt(to, timezone) },
      },
    });

    const completionsByDay: Partial<Record<DayOfWeek, typeof completions>> = groupBy(
      completions,
      (c) => dayIndexToDayOfWeek(sundayBasedDayIndex(c.date)),
    );

    return DAY_OF_WEEK_ORDER.map((day) => {
      const dayCompletions = completionsByDay[day] ?? [];
      return {
        day,
        total: sumBy(dayCompletions, (c) => c.totalTodos),
        completed: sumBy(dayCompletions, (c) => c.completedTodos),
      };
    });
  }

  async findTimeCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TimeCompletionRate> {
    const todos = await this.#db.query.todo.findMany({
      columns: { completedAt: true },
      where: {
        userId,
        completed: true,
        completedAt: { isNotNull: true },
        startDate: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
    });

    const { morning = 0, afternoon = 0 } = countBy(
      compact(todos.map((t) => t.completedAt)),
      (completedAt) => (localDateTimeAt(completedAt, timezone).hour < 12 ? "morning" : "afternoon"),
    );

    const total = morning + afternoon;
    return {
      morning: {
        count: morning,
        rate: total > 0 ? Math.round((morning / total) * 100) : 0,
      },
      afternoon: {
        count: afternoon,
        rate: total > 0 ? Math.round((afternoon / total) * 100) : 0,
      },
    };
  }

  async findCategoryCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone = "UTC",
  ): Promise<CategoryCompletionRate[]> {
    const todos = await this.#db.query.todo.findMany({
      columns: { completed: true },
      with: { category: { columns: { name: true } } },
      where: {
        userId,
        startDate: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
    });

    const categoryMap = new Map<string, { total: number; completed: number }>();

    for (const t of todos) {
      const name = requireRecord(t.category).name;
      const entry = categoryMap.get(name) ?? { total: 0, completed: 0 };
      entry.total++;
      if (t.completed) {
        entry.completed++;
      }
      categoryMap.set(name, entry);
    }

    return [...categoryMap.entries()]
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async findUserStreakInfo(userId: string): Promise<UserStreakInfo | null> {
    const pref = await this.#db.query.userPreference.findFirst({
      columns: { currentStreak: true, longestStreak: true },
      where: { userId },
    });

    if (pref == null) {
      return null;
    }

    return {
      currentStreak: pref.currentStreak,
      longestStreak: pref.longestStreak,
    };
  }

  async findRecentTodos(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]> {
    const todos = await this.#db.query.todo.findMany({
      columns: {
        title: true,
        startDate: true,
        scheduledLocalTime: true,
        scheduledTime: true,
        categoryId: true,
        completed: true,
      },
      with: { category: { columns: { name: true } } },
      where: {
        userId,
        seriesId: { isNull: true },
        startDate: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
      // 최근 기록부터 상한까지만 읽고, 기존 소비 순서(날짜 오름차순)로 되돌린다.
      orderBy: { startDate: "desc" },
      limit: AI_SUGGESTION_LIMITS.MAX_ANALYSIS_TODOS,
    });

    return todos.toReversed().map((t) => ({
      title: t.title,
      startDate: plainDateOfDateColumn(t.startDate).toString(),
      scheduledTime:
        t.scheduledTime == null
          ? null
          : (t.scheduledLocalTime ?? toWallClock(localDateTimeAt(t.scheduledTime, timezone))),
      categoryId: t.categoryId,
      completed: t.completed,
      categoryName: requireRecord(t.category).name,
    }));
  }

  async findRecentResponded(userId: string, since: Date): Promise<SuggestionHistoryItem[]> {
    const rows = await this.#db.query.recurringSuggestion.findMany({
      columns: { title: true, status: true },
      where: {
        userId,
        status: { in: ["ACCEPTED", "DISMISSED"] },
        updatedAt: { gte: instantFromDate(since) },
      },
    });

    return rows.map((row) => ({
      title: row.title,
      status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
    }));
  }
}
