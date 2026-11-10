import { TransactionHost } from "@nestjs-cls/transactional";
import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { and, count, eq, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
  freeAccessCondition,
  premiumAccessCondition,
} from "#api/modules/access/entitlements/access-entitlements.public";
import {
  ReminderCacheKey,
  REMINDER_CACHE_TTL_MS,
} from "#api/modules/notification/reminders/infrastructure/cache/reminder-cache.keyspace";
import { notificationRetentionConfig } from "#api/modules/notification/retention/notification-retention.config";
import { CacheService } from "#api/platform/cache/cache.service";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, userPreference } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { instantToDate } from "#api/shared/domain/time/instant";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

import { resolveRecipientLocale } from "../../../push/domain/recipient-locale.domain-service.js";
import type {
  InactiveWindowParams,
  ReEngagementReaderPort,
  SocialDigestCandidateParams,
  TodayRangeParams,
} from "../../application/ports/re-engagement-reader.port.js";
import type {
  CustomTimeReminderParams,
  FixedTimeReminderParams,
  PeriodReportParams,
  ScheduledReminderReaderPort,
} from "../../application/ports/scheduled-reminder-reader.port.js";
import type { SchedulerPreferenceReaderPort } from "../../application/ports/scheduler-preference-reader.port.js";
import type { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port.js";
import type {
  WeatherReminderParams,
  WeatherReminderReaderPort,
} from "../../application/ports/weather-reminder-reader.port.js";
import type {
  WeeklyAchievementStatsReaderPort,
  WeeklyStatsParams,
} from "../../application/ports/weekly-achievement-stats-reader.port.js";
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
  WeatherReminderUser,
  WinbackUser,
} from "../../application/read-models/scheduler.read-model.js";

/**
 * 스케줄러 리더 어댑터 (Drizzle).
 *
 * 스케줄러의 모든 읽기 포트를 단일 영속성 어댑터로 구현한다.
 * (조회 계약은 포트별로 분리되어 있고, 어댑터는 DB 접근을 응집한다)
 */
type RetentionSettings = Pick<ConfigType<typeof notificationRetentionConfig>, "onboardingV2">;

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
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #cacheService: CacheService;
  readonly #retention: RetentionSettings;
  readonly #clock: ClockPort;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    cacheService: CacheService,
    @Inject(notificationRetentionConfig.KEY) retention: RetentionSettings,
    clock: ClockPort,
  ) {
    this.#txHost = txHost;
    this.#cacheService = cacheService;
    this.#retention = retention;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // access 권한 조건은 아직 Date로 받는다
  #now(): Date {
    return instantToDate(this.#clock.now());
  }

  // ─────────────────────────────────────────────────────────────
  // ScheduledReminderReaderPort — 아침/저녁 리마인더·리포트·점심 넛지
  // ─────────────────────────────────────────────────────────────

  async findPremiumMorningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<ReminderCountUser[]> {
    const { tz, hour, minute, today, tomorrow, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        RAW: (target) => premiumAccessCondition(target, this.#now()),
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
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, this.#now()),
        preference: { timezone: tz },
      },
      with: { preference: { columns: { locale: true } } },
      extras: { todoCount: (user) => this.#todoCount(user.id, today, tomorrow) },
    });
    return rows.map(({ todoCount, ...row }) => ({ ...row, _count: { todos: todoCount } }));
  }

  async findPremiumEveningReminderUsers(
    params: CustomTimeReminderParams,
  ): Promise<UserWithTodosAndStreak[]> {
    const { tz, hour, minute, today, tomorrow, userId } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        ...(userId && { id: userId }),
        RAW: (target) => premiumAccessCondition(target, this.#now()),
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
    return rows;
  }

  async findFreeEveningReminderUsers(
    params: FixedTimeReminderParams,
  ): Promise<UserWithTodosAndStreak[]> {
    const { tz, today, tomorrow } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        RAW: (target) => freeAccessCondition(target, this.#now()),
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
    return rows;
  }

  findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]> {
    const { tz, today, tomorrow } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
            },
          },
          {
            NOT: {
              todos: {
                startDate: { gte: today, lt: tomorrow },
                completed: true,
              },
            },
          },
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
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        preference: { timezone: tz },
        RAW: (target) => premiumAccessCondition(target, this.#now()),
        todos: {
          startDate: { gte: periodStart, lt: periodEnd },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ReEngagementReaderPort — winback·온보딩·넛지추천·소셜다이제스트·스트릭
  // ─────────────────────────────────────────────────────────────

  async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]> {
    const { tz, inactiveSince, inactiveUntil } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true, lastActiveAt: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          {
            lastActiveAt: {
              gte: inactiveSince,
              lte: inactiveUntil,
            },
          },
        ],
      },
    });
    return rows;
  }

  async findOnboardingCandidates(params: {
    tz: string;
    createdSince: Temporal.Instant;
  }): Promise<OnboardingCandidate[]> {
    const { tz, createdSince } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true, createdAt: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { createdAt: { gte: createdSince } },
          { preference: { timezone: tz } },
        ],
      },
    });
    return rows;
  }

  countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]> {
    return this.#db
      .select({ userId: todo.userId, count: count() })
      .from(todo)
      .where(and(inArray(todo.userId, userIds), eq(todo.completed, true)))
      .groupBy(todo.userId);
  }

  findActiveUsersInTimezone(tz: string): Promise<UserIdRow[]> {
    return this.#db.query.user.findMany({
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

  async findNudgeSuggestFollows(params: {
    candidateIds: string[];
    activeSince: Temporal.Instant;
    activeUntil: Temporal.Instant;
  }): Promise<NudgeSuggestFollow[]> {
    const { candidateIds, activeSince, activeUntil } = params;
    const activeWindow = {
      lastActiveAt: { gte: activeSince, lte: activeUntil },
    };
    const rows = await this.#db.query.follow.findMany({
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
    return rows;
  }

  findSocialDigestCandidates(
    params: SocialDigestCandidateParams,
  ): Promise<SocialDigestCandidate[]> {
    const { tz, today, tomorrow, recipientUserIds } = params;
    return this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          { id: { in: [...recipientUserIds] } },
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
              completed: false,
            },
          },
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
    return this.#db.query.follow.findMany({
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
    today: Temporal.PlainDate;
    tomorrow: Temporal.PlainDate;
  }): Promise<FriendWithTodos[]> {
    const { friendIds, today, tomorrow } = params;
    return this.#db.query.user.findMany({
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

  async findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]> {
    const { tz, today, tomorrow } = params;
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        AND: [
          ...this.#recentTreatmentExclusion(),
          { preference: { timezone: tz, currentStreak: { gte: 3 } } },
          {
            todos: {
              startDate: { gte: today, lt: tomorrow },
              completed: false,
            },
          },
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
    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  // WeatherReminderReaderPort — 아침/저녁 날씨 알림
  // ─────────────────────────────────────────────────────────────

  findWeatherMorningUsersWithLocation(
    params: WeatherReminderParams,
  ): Promise<WeatherReminderUser[]> {
    const { tz, hour, minute, userId } = params;
    return this.#db.query.user.findMany({
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
    return this.#db.query.user.findMany({
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
    return this.#db.query.user.findMany({
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
    return this.#db.query.user.findMany({
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

  // ─────────────────────────────────────────────────────────────
  // WeeklyAchievementStatsReaderPort — 주간 달성 집계
  // ─────────────────────────────────────────────────────────────

  groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    return this.#countTodoDaysByUser(params);
  }

  groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
    return this.#countTodoDaysByUser(params, eq(todo.completed, true));
  }

  // 여러 날 할 일은 기간 안에 걸친 날마다 하나로 센다. 끝없이 긴 할 일도 기간 안의 날만 더한다
  #countTodoDaysByUser(params: WeeklyStatsParams, extra?: SQL): Promise<UserTodoCount[]> {
    const { tz, periodStart, periodEnd } = params;
    const firstDay = sql`${sql.param(periodStart, todo.startDate)}::date`;
    const lastDay = sql`(${sql.param(periodEnd, todo.startDate)}::date - 1)`;
    const todoLastDay = sql`coalesce(${todo.endDate}, ${todo.startDate})`;
    const daysInPeriod = sql<number>`sum(greatest(0, least(${todoLastDay}, ${lastDay}) - greatest(${todo.startDate}, ${firstDay}) + 1))::int`;
    return this.#db
      .select({ userId: todo.userId, count: daysInPeriod })
      .from(todo)
      .where(
        and(
          sql`${todo.startDate} <= ${lastDay}`,
          sql`${todoLastDay} >= ${firstDay}`,
          extra,
          this.#inTimezone(tz),
        ),
      )
      .groupBy(todo.userId);
  }

  async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.#db.query.user.findMany({
      columns: { id: true },
      where: {
        id: { in: userIds },
        RAW: (target) => freeAccessCondition(target, this.#now()),
      },
    });
    return new Set(rows.map((row) => row.id));
  }

  // ─────────────────────────────────────────────────────────────
  // TodoReminderReaderPort — 지연 잡 처리용
  // ─────────────────────────────────────────────────────────────

  async findActiveTodo(todoId: number): Promise<ActiveTodo | null> {
    const row = await this.#db.query.todo.findFirst({
      columns: {
        id: true,
        title: true,
        seriesId: true,
        startDate: true,
        scheduledLocalTime: true,
        scheduledTime: true,
      },
      where: { id: todoId, completed: false },
    });
    if (row == null) {
      return null;
    }
    const { scheduledTime, ...rest } = row;
    return { ...rest, startDate: row.startDate.toString(), scheduledAt: scheduledTime };
  }

  // ─────────────────────────────────────────────────────────────
  // SchedulerPreferenceReaderPort — 활성 타임존·푸시 로케일
  // ─────────────────────────────────────────────────────────────

  async findActiveTimezones(): Promise<string[]> {
    return this.#cacheService.wrap(
      ReminderCacheKey.activeTimezones(),
      z.array(z.string()),
      async (): Promise<string[]> => {
        const rows = await this.#db
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
    const preferences = await this.#db.query.userPreference.findMany({
      columns: { userId: true, locale: true },
      where: { userId: { in: userIds } },
    });
    return new Map(
      preferences.map((preference) => [
        preference.userId,
        resolveRecipientLocale({ storedLocale: preference.locale, lastRequestLocale: null }),
      ]),
    );
  }

  #todoCount(userId: AnyColumn, today: Temporal.PlainDate, tomorrow: Temporal.PlainDate) {
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
      this.#db
        .select({ userId: userPreference.userId })
        .from(userPreference)
        .where(eq(userPreference.timezone, tz)),
    );
  }

  /** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
  #recentTreatmentExclusion() {
    if (!this.#retention.onboardingV2.enabled) {
      return [];
    }
    return [
      {
        NOT: {
          retentionAssignments: {
            experimentKey: "onboarding_v2_d7",
            variant: "TREATMENT" as const,
            startedAt: { gte: this.#clock.now().subtract({ hours: 8 * 24 }) },
          },
        },
      },
    ];
  }
}
