import {
  AI_SUGGESTION_LIMITS,
  DAY_OF_WEEK_ORDER,
  type DayOfWeek,
  dayIndexToDayOfWeek,
} from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { and, eq, lt } from "drizzle-orm";
import { compact, countBy, groupBy, sumBy } from "es-toolkit";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { recurringSuggestion } from "#api/platform/database/schema/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  AiSuggestionRepositoryPort,
  CreateSuggestionInput,
} from "../../../application/ports/suggestions/ai-suggestion.repository.port.js";
import {
  Suggestion,
  type SuggestionStatus,
} from "../../../domain/aggregates/suggestions/suggestion.aggregate.js";
import type {
  CategoryCompletionRate,
  DayCompletionRate,
  SuggestionHistoryItem,
  TimeCompletionRate,
  TodoSummaryForAnalysis,
  UserStreakInfo,
} from "../../../domain/types/suggestions/ai-suggestion.types.js";

type RecurringSuggestionRow = typeof recurringSuggestion.$inferSelect;

function localDay(value: Date, timezone: string): Date {
  return startOfDayInTimezone(value, timezone);
}

/**
 * AiSuggestionRepositoryPort의 Drizzle 어댑터.
 *
 * RecurringSuggestion의 쓰기·단건 조회는 Suggestion 애그리게잇으로 재구성하고,
 * 분석용 통계 읽기는 도메인 프로젝션으로 반환한다. 트랜잭션은 CLS(TransactionHost.tx)로 전파된다.
 */
@Injectable()
export class DrizzleAiSuggestionRepository implements AiSuggestionRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private static toEntity(row: RecurringSuggestionRow): Suggestion {
    return Suggestion.reconstitute({
      id: row.id,
      userId: row.userId,
      title: row.title,
      daysOfWeek: row.daysOfWeek,
      scheduledTime: row.scheduledTime,
      confidence: row.confidence,
      reason: row.reason,
      matchedTodos: row.matchedTodos,
      suggestedCategoryId: row.suggestedCategoryId,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findPendingByUserId(userId: string): Promise<Suggestion[]> {
    const rows = await this.db.query.recurringSuggestion.findMany({
      where: { userId, status: "PENDING", expiresAt: { gt: now() } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => DrizzleAiSuggestionRepository.toEntity(row));
  }

  async findByIdAndUserId(id: number, userId: string): Promise<Suggestion | null> {
    const row = await this.db.query.recurringSuggestion.findFirst({ where: { id, userId } });
    return row == null ? null : DrizzleAiSuggestionRepository.toEntity(row);
  }

  async updateStatus(id: number, status: SuggestionStatus): Promise<Suggestion> {
    const [row] = await this.db
      .update(recurringSuggestion)
      .set({ status })
      .where(eq(recurringSuggestion.id, id))
      .returning();
    return DrizzleAiSuggestionRepository.toEntity(requireRecord(row));
  }

  async createMany(data: CreateSuggestionInput[]): Promise<{ count: number }> {
    if (data.length === 0) {
      return { count: 0 };
    }
    const created = await this.db
      .insert(recurringSuggestion)
      .values(data)
      .returning({ id: recurringSuggestion.id });
    return { count: created.length };
  }

  async deletePending(userId: string): Promise<{ count: number }> {
    const deleted = await this.db
      .delete(recurringSuggestion)
      .where(and(eq(recurringSuggestion.userId, userId), eq(recurringSuggestion.status, "PENDING")))
      .returning({ id: recurringSuggestion.id });
    return { count: deleted.length };
  }

  async deleteExpired(userId: string): Promise<{ count: number }> {
    const deleted = await this.db
      .delete(recurringSuggestion)
      .where(and(eq(recurringSuggestion.userId, userId), lt(recurringSuggestion.expiresAt, now())))
      .returning({ id: recurringSuggestion.id });
    return { count: deleted.length };
  }

  async findDayCompletionRates(
    userId: string,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<DayCompletionRate[]> {
    const completions = await this.db.query.dailyCompletion.findMany({
      columns: { date: true, totalTodos: true, completedTodos: true },
      where: {
        userId,
        date: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
    });

    const completionsByDay: Partial<Record<DayOfWeek, typeof completions>> = groupBy(
      completions,
      (c) => dayIndexToDayOfWeek(dayjs.utc(c.date).day()),
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
    const todos = await this.db.query.todo.findMany({
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
      (completedAt) => (dayjs(completedAt).tz(timezone).hour() < 12 ? "morning" : "afternoon"),
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
    const todos = await this.db.query.todo.findMany({
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
    const pref = await this.db.query.userPreference.findFirst({
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
    const todos = await this.db.query.todo.findMany({
      columns: {
        title: true,
        startDate: true,
        scheduledTime: true,
        categoryId: true,
        completed: true,
      },
      with: { category: { columns: { name: true } } },
      where: {
        userId,
        recurrenceGroupId: { isNull: true },
        startDate: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
      // 최근 기록부터 상한까지만 읽고, 기존 소비 순서(날짜 오름차순)로 되돌린다.
      orderBy: { startDate: "desc" },
      limit: AI_SUGGESTION_LIMITS.MAX_ANALYSIS_TODOS,
    });

    return todos.toReversed().map((t) => ({
      title: t.title,
      startDate: toDateString(t.startDate),
      scheduledTime:
        t.scheduledTime == null ? null : dayjs(t.scheduledTime).tz(timezone).format("HH:mm"),
      categoryId: t.categoryId,
      completed: t.completed,
      categoryName: requireRecord(t.category).name,
    }));
  }

  async findRecentResponded(userId: string, since: Date): Promise<SuggestionHistoryItem[]> {
    const rows = await this.db.query.recurringSuggestion.findMany({
      columns: { title: true, status: true },
      where: { userId, status: { in: ["ACCEPTED", "DISMISSED"] }, updatedAt: { gte: since } },
    });

    return rows.map((row) => ({
      title: row.title,
      status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
    }));
  }
}
