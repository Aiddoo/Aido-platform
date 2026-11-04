import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, gte, inArray, lt, sql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";

import {
  freeAccessCondition,
  premiumAccessCondition,
} from "#api/modules/access/access-entitlement-sql.public";
import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "#api/modules/notification/infrastructure/cache/reminders/reminder-cache.keyspace";
import { CacheService } from "#api/platform/cache/cache.service";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, userPreference } from "#api/platform/database/schema/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";

import type {
  InactiveWindowParams,
  ReEngagementReaderPort,
  SocialDigestCandidateParams,
  TodayRangeParams,
} from "../../../application/ports/reminders/re-engagement-reader.port.js";
import type {
  CustomTimeReminderParams,
  FixedTimeReminderParams,
  PeriodReportParams,
  ScheduledReminderReaderPort,
} from "../../../application/ports/reminders/scheduled-reminder-reader.port.js";
import type { SchedulerPreferenceReaderPort } from "../../../application/ports/reminders/scheduler-preference-reader.port.js";
import type {
  ActiveTodo,
  FollowPair,
  FriendWithTodos,
  NudgeSuggestFollow,
  OnboardingCandidate,
  ReminderCountUser,
  SocialDigestCandidate,
  UserIdRow,
  UserLocaleMap,
  UserTodoCount,
  UserWithTodosAndStreak,
  WeatherFallbackUser,
  WeatherReminderTodo,
  WeatherReminderUser,
  WinbackUser,
} from "../../../application/ports/reminders/scheduler-read-models.js";
import type { TodoReminderReaderPort } from "../../../application/ports/reminders/todo-reminder-reader.port.js";
import type {
  WeatherReminderParams,
  WeatherReminderReaderPort,
  WeatherReminderTodoQuery,
} from "../../../application/ports/reminders/weather-reminder-reader.port.js";
import type {
  WeeklyAchievementStatsReaderPort,
  WeeklyStatsParams,
} from "../../../application/ports/reminders/weekly-achievement-stats-reader.port.js";

/**
 * 스케줄러 리더 어댑터 (Drizzle).
 *
 * 스케줄러의 모든 읽기 포트를 단일 영속성 어댑터로 구현한다.
 * (조회 계약은 포트별로 분리되어 있고, 어댑터는 DB 접근을 응집한다)
 */
@Injectable()
export class DrizzleSchedulerReader
  implements
    ScheduledReminderReaderPort,
    ReEngagementReaderPort,
    WeatherReminderReaderPort,
    WeeklyAchievementStatsReaderPort,
    TodoReminderReaderPort,
    SchedulerPreferenceReaderPort
{
  constructor(
    private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>,
    private readonly cacheService: CacheService,
    private readonly config: TypedConfigService,
  ) {}

  private get db() {
    return this.txHost.tx;
  }

  // ─────────────────────────────────────────────────────────────
  // ScheduledReminderReaderPort — 아침/저녁 리마인더·리포트·점심 넛지
  // ─────────────────────────────────────────────────────────────

  async findPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUser[]> {
    const { tz, hour, minute, today, tomorrow, userId } = params;
    const rows = await this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        RAW: (target) => premiumAccessCondition(target, now()),
        preference: { timezone: tz, morningReminderHour: hour, morningReminderMinute: minute },
      },
      with: { preference: { columns: { locale: true } } },
      extras: { todoCount: (user) => this.#todoCount(user.id, today, tomorrow) },
    });
    return rows.map(({ todoCount, ...row }) => ({ ...row, _count: { todos: todoCount } }));
  }

  async findFreeMorningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<ReminderCountUser[]> {
    const { tz, today, tomorrow } = params;
    const rows = await this.db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, now()),
        preference: { timezone: tz },
      },
      with: { preference: { columns: { locale: true } } },
      extras: { todoCount: (user) => this.#todoCount(user.id, today, tomorrow) },
    });
    return rows.map(({ todoCount, ...row }) => ({ ...row, _count: { todos: todoCount } }));
  }

  findPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<UserWithTodosAndStreak[]> {
    const { tz, hour, minute, today, tomorrow, userId } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        RAW: (target) => premiumAccessCondition(target, now()),
        preference: { timezone: tz, eveningReminderHour: hour, eveningReminderMinute: minute },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: { columns: { currentStreak: true, lastCompletedDate: true, locale: true } },
      },
    });
  }

  findFreeEveningReminderUsers(params: FixedTimeReminderParams): Promise<UserWithTodosAndStreak[]> {
    const { tz, today, tomorrow } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, now()),
        preference: { timezone: tz },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: { columns: { currentStreak: true, lastCompletedDate: true, locale: true } },
      },
    });
  }

  findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]> {
    const { tz, today, tomorrow } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          { todos: { startDate: { gte: today, lt: tomorrow } } },
          { NOT: { todos: { startDate: { gte: today, lt: tomorrow }, completed: true } } },
        ],
      },
    });
  }

  findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
    return this.#findPeriodReportRecipients(params);
  }

  findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
    return this.#findPeriodReportRecipients(params);
  }

  #findPeriodReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
    const { tz, periodStart, periodEnd } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        preference: { timezone: tz },
        RAW: (target) => premiumAccessCondition(target, now()),
        todos: { startDate: { gte: periodStart, lt: periodEnd } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ReEngagementReaderPort — winback·온보딩·넛지추천·소셜다이제스트·스트릭
  // ─────────────────────────────────────────────────────────────

  findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]> {
    const { tz, inactiveSince, inactiveUntil } = params;
    return this.db.query.user.findMany({
      columns: { id: true, lastActiveAt: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          { lastActiveAt: { gte: inactiveSince, lte: inactiveUntil } },
        ],
      },
    });
  }

  findOnboardingCandidates(params: {
    tz: string;
    createdSince: Date;
  }): Promise<OnboardingCandidate[]> {
    const { tz, createdSince } = params;
    return this.db.query.user.findMany({
      columns: { id: true, createdAt: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { createdAt: { gte: createdSince } },
          { preference: { timezone: tz } },
        ],
      },
    });
  }

  countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]> {
    return this.db
      .select({ userId: todo.userId, count: count() })
      .from(todo)
      .where(and(inArray(todo.userId, userIds), eq(todo.completed, true)))
      .groupBy(todo.userId);
  }

  findActiveUsersInTimezone(tz: string): Promise<UserIdRow[]> {
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          { deletedAt: { isNull: true } },
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
        ],
      },
    });
  }

  findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Date;
    activeUntil: Date;
  }): Promise<NudgeSuggestFollow[]> {
    const { candidateIds, activeSince, activeUntil } = params;
    const activeWindow = { lastActiveAt: { gte: activeSince, lte: activeUntil } };
    return this.db.query.follow.findMany({
      columns: { followerId: true, followingId: true },
      where: {
        OR: [
          { followerId: { in: candidateIds }, status: "ACCEPTED", following: activeWindow },
          { followingId: { in: candidateIds }, status: "ACCEPTED", follower: activeWindow },
        ],
      },
      with: {
        follower: {
          columns: { id: true, lastActiveAt: true },
          with: { profile: { columns: { name: true } } },
        },
        following: {
          columns: { id: true, lastActiveAt: true },
          with: { profile: { columns: { name: true } } },
        },
      },
    });
  }

  findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidate[]> {
    const { tz, today, tomorrow, recipientUserIds } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          { id: { in: [...recipientUserIds] } },
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          { todos: { startDate: { gte: today, lt: tomorrow }, completed: false } },
        ],
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
      },
    });
  }

  findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]> {
    return this.db.query.follow.findMany({
      columns: { followerId: true, followingId: true },
      where: {
        OR: [
          { followerId: { in: candidateIds }, status: "ACCEPTED" },
          { followingId: { in: candidateIds }, status: "ACCEPTED" },
        ],
      },
    });
  }

  findFriendsWithTodayTodos(params: {
    friendIds: string[];
    today: Date;
    tomorrow: Date;
  }): Promise<FriendWithTodos[]> {
    const { friendIds, today, tomorrow } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        id: { in: friendIds },
        todos: { startDate: { gte: today, lt: tomorrow } },
      },
      with: {
        profile: { columns: { name: true } },
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
      },
    });
  }

  findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]> {
    const { tz, today, tomorrow } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz, currentStreak: { gte: 3 } } },
          { todos: { startDate: { gte: today, lt: tomorrow }, completed: false } },
        ],
      },
      with: {
        todos: {
          columns: { completed: true },
          where: { startDate: { gte: today, lt: tomorrow } },
        },
        preference: { columns: { currentStreak: true, lastCompletedDate: true, locale: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WeatherReminderReaderPort — 아침/저녁 날씨 알림
  // ─────────────────────────────────────────────────────────────

  findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]> {
    const { tz, hour, minute, userId } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherMorningEnabled: true,
          timezone: tz,
          weatherMorningHour: hour,
          weatherMorningMinute: minute,
        },
        location: true,
      },
      with: {
        preference: { columns: { locale: true } },
        location: { columns: { latitude: true, longitude: true } },
      },
    });
  }

  findWeatherMorningFallbackUsers(params: WeatherReminderParams): Promise<WeatherFallbackUser[]> {
    const { tz, hour, minute, userId } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherMorningEnabled: true,
          timezone: tz,
          weatherMorningHour: hour,
          weatherMorningMinute: minute,
        },
        NOT: { location: true },
      },
      with: { preference: { columns: { locale: true } } },
    });
  }

  findWeatherEveningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]> {
    const { tz, hour, minute, userId } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherEveningEnabled: true,
          timezone: tz,
          weatherEveningHour: hour,
          weatherEveningMinute: minute,
        },
        location: true,
      },
      with: {
        preference: { columns: { locale: true } },
        location: { columns: { latitude: true, longitude: true } },
      },
    });
  }

  findWeatherEveningFallbackUsers(params: WeatherReminderParams): Promise<WeatherFallbackUser[]> {
    const { tz, hour, minute, userId } = params;
    return this.db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        status: "ACTIVE",
        deletedAt: { isNull: true },
        preference: {
          weatherEveningEnabled: true,
          timezone: tz,
          weatherEveningHour: hour,
          weatherEveningMinute: minute,
        },
        NOT: { location: true },
      },
      with: { preference: { columns: { locale: true } } },
    });
  }

  async findScheduledTodosBetween(
    params: WeatherReminderTodoQuery,
  ): Promise<WeatherReminderTodo[]> {
    const { userIds, from, until } = params;
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        id: todo.id,
        userId: todo.userId,
        title: todo.title,
        scheduledTime: todo.scheduledTime,
      })
      .from(todo)
      .where(
        and(
          inArray(todo.userId, [...userIds]),
          eq(todo.isAllDay, false),
          eq(todo.completed, false),
          gte(todo.scheduledTime, from),
          lt(todo.scheduledTime, until),
        ),
      )
      .orderBy(asc(todo.scheduledTime), asc(todo.id));
    return rows.flatMap(({ scheduledTime, ...row }) =>
      scheduledTime == null ? [] : [{ ...row, scheduledTime }],
    );
  }

  // ─────────────────────────────────────────────────────────────
  // WeeklyAchievementStatsReaderPort — 주간 달성 집계
  // ─────────────────────────────────────────────────────────────

  groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    const { tz, periodStart, periodEnd } = params;
    return this.db
      .select({ userId: todo.userId, count: count() })
      .from(todo)
      .where(
        and(gte(todo.startDate, periodStart), lt(todo.startDate, periodEnd), this.#inTimezone(tz)),
      )
      .groupBy(todo.userId);
  }

  groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    const { tz, periodStart, periodEnd } = params;
    return this.db
      .select({ userId: todo.userId, count: count() })
      .from(todo)
      .where(
        and(
          gte(todo.startDate, periodStart),
          lt(todo.startDate, periodEnd),
          eq(todo.completed, true),
          this.#inTimezone(tz),
        ),
      )
      .groupBy(todo.userId);
  }

  async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.db.query.user.findMany({
      columns: { id: true },
      where: {
        id: { in: userIds },
        RAW: (target) => freeAccessCondition(target, now()),
      },
    });
    return new Set(rows.map((row) => row.id));
  }

  // ─────────────────────────────────────────────────────────────
  // TodoReminderReaderPort — 지연 잡 처리용
  // ─────────────────────────────────────────────────────────────

  async findActiveTodo(todoId: number): Promise<ActiveTodo | null> {
    const row = await this.db.query.todo.findFirst({
      columns: { id: true, title: true, seriesId: true },
      where: { id: todoId, completed: false },
    });
    return row ?? null;
  }

  async existsRecentReminderNotification(params: {
    todoId: number;
    since: Date;
    stage: string;
  }): Promise<boolean> {
    const { todoId, since, stage } = params;
    const existing = await this.db.query.notification.findFirst({
      columns: { id: true },
      where: {
        todoId,
        type: "TODO_REMINDER",
        createdAt: { gte: since },
        RAW: (table) => sql`${table.metadata} ->> 'stage' = ${stage}`,
      },
    });
    return existing != null;
  }

  // ─────────────────────────────────────────────────────────────
  // SchedulerPreferenceReaderPort — 활성 타임존·푸시 로케일
  // ─────────────────────────────────────────────────────────────

  async findActiveTimezones(): Promise<string[]> {
    return this.cacheService.wrap(
      ReminderCacheKey.activeTimezones(),
      z.array(z.string()),
      async (): Promise<string[]> => {
        const rows = await this.db
          .selectDistinct({ timezone: userPreference.timezone })
          .from(userPreference);
        return rows.flatMap((row) =>
          normalizeIanaTimezone(row.timezone) != null ? [row.timezone] : [],
        );
      },
      REMINDER_CACHE_TTL_MS,
    );
  }

  async findUserLocales(userIds: string[]): Promise<UserLocaleMap> {
    if (userIds.length === 0) {
      return new Map();
    }
    const preferences = await this.db.query.userPreference.findMany({
      columns: { userId: true, locale: true },
      where: { userId: { in: userIds } },
    });
    return new Map(
      preferences.map((preference) => [preference.userId, toSupportedLocale(preference.locale)]),
    );
  }

  #todoCount(userId: AnyColumn, today: Date, tomorrow: Date) {
    return sql<number>`(
      SELECT count(*)::int FROM ${todo}
      WHERE ${todo.userId} = ${userId}
        AND ${todo.startDate} >= ${sql.param(today, todo.startDate)}
        AND ${todo.startDate} < ${sql.param(tomorrow, todo.startDate)}
    )`;
  }

  #inTimezone(tz: string) {
    return inArray(
      todo.userId,
      this.db
        .select({ userId: userPreference.userId })
        .from(userPreference)
        .where(eq(userPreference.timezone, tz)),
    );
  }

  /** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
  #recentTreatmentExclusion() {
    if (!this.config.retentionOnboardingV2.enabled) {
      return [];
    }
    return [
      {
        NOT: {
          retentionAssignments: {
            experimentKey: "onboarding_v2_d7",
            variant: "TREATMENT" as const,
            startedAt: { gte: subtractDays(8) },
          },
        },
      },
    ];
  }
}
