import { Injectable } from "@nestjs/common";
import type { ModelAccessor } from "@prisma/orm-postgres/orm-client";
import { all, and, or } from "@prisma/orm-postgres/orm-client";

import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { normalizeIanaTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";
import { CacheService } from "#api/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";
import { decodeRecord } from "#api/shared/infrastructure/database/database-records";
import {
	databaseDate,
	databaseTimestamp,
	varchar,
} from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";

import type { Contract } from "../../../generated/prisma8/contract.d.js";
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
} from "../../application/ports/scheduler-read-models.js";
import type { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port.js";
import type {
	WeatherReminderParams,
	WeatherReminderReaderPort,
} from "../../application/ports/weather-reminder-reader.port.js";
import type {
	WeeklyAchievementStatsReaderPort,
	WeeklyStatsParams,
} from "../../application/ports/weekly-achievement-stats-reader.port.js";

/**
 * 스케줄러 리더 어댑터 (Prisma).
 *
 * 스케줄러의 모든 읽기 포트를 단일 영속성 어댑터로 구현한다.
 * (조회 계약은 포트별로 분리되어 있고, 어댑터는 Prisma 접근을 응집한다)
 *
 * 쿼리 형태(where/select)는 기존 전략과 byte-identical 하게 보존한다.
 */
@Injectable()
export class PrismaSchedulerReader
	implements
		ScheduledReminderReaderPort,
		ReEngagementReaderPort,
		WeatherReminderReaderPort,
		WeeklyAchievementStatsReaderPort,
		TodoReminderReaderPort,
		SchedulerPreferenceReaderPort
{
	constructor(
		private readonly database: DatabaseService,
		private readonly cacheService: CacheService,
		private readonly config: TypedConfigService,
	) {}

	// ─────────────────────────────────────────────────────────────
	// ScheduledReminderReaderPort — 아침/저녁 리마인더·리포트·점심 넛지
	// ─────────────────────────────────────────────────────────────

	async findPremiumMorningReminderUsers(
		params: CustomTimeReminderParams,
	): Promise<ReminderCountUser[]> {
		const { tz, hour, minute, today, tomorrow, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
				row.preference.some((related) =>
					and(
						related.timezone.eq(varchar(tz, 50)),
						related.morningReminderHour.eq(hour),
						related.morningReminderMinute.eq(minute),
					),
				),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.count(),
			)
			.all()
			.then((rows) => rows.map(({ todos, ...row }) => ({ ...row, _count: { todos } })))
			.then((row) => decodeRecord("User", row));
	}

	async findFreeMorningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<ReminderCountUser[]> {
		const { tz, today, tomorrow } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.subscriptionStatus.neq("ACTIVE"),
				row.role.neq("ADMIN"),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.count(),
			)
			.all()
			.then((rows) => rows.map(({ todos, ...row }) => ({ ...row, _count: { todos } })))
			.then((row) => decodeRecord("User", row));
	}

	async findPremiumEveningReminderUsers(
		params: CustomTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]> {
		const { tz, hour, minute, today, tomorrow, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
				row.preference.some((related) =>
					and(
						related.timezone.eq(varchar(tz, 50)),
						related.eveningReminderHour.eq(hour),
						related.eveningReminderMinute.eq(minute),
					),
				),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
					),
				),
			),
		)
			.select("id")
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.select("completed"),
			)
			.include("preference", (related) =>
				related.select("currentStreak", "lastCompletedDate", "locale"),
			)
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findFreeEveningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]> {
		const { tz, today, tomorrow } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.subscriptionStatus.neq("ACTIVE"),
				row.role.neq("ADMIN"),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
					),
				),
			),
		)
			.select("id")
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.select("completed"),
			)
			.include("preference", (related) =>
				related.select("currentStreak", "lastCompletedDate", "locale"),
			)
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]> {
		const { tz, today, tomorrow } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				this.#recentTreatmentExclusion(row),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
					),
				),
				row.todos.none((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
						related.completed.eq(true),
					),
				),
			),
		)
			.select("id")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
		const { tz, periodStart, periodEnd } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(periodStart)),
						related.startDate.lt(databaseDate(periodEnd)),
					),
				),
			),
		)
			.select("id")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
		const { tz, periodStart, periodEnd } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				or(row.subscriptionStatus.eq("ACTIVE"), row.role.eq("ADMIN")),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(periodStart)),
						related.startDate.lt(databaseDate(periodEnd)),
					),
				),
			),
		)
			.select("id")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	// ─────────────────────────────────────────────────────────────
	// ReEngagementReaderPort — winback·온보딩·넛지추천·소셜다이제스트·스트릭
	// ─────────────────────────────────────────────────────────────

	async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]> {
		const { tz, inactiveSince, inactiveUntil } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				this.#recentTreatmentExclusion(row),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				row.lastActiveAt.gte(databaseTimestamp(inactiveSince)),
				row.lastActiveAt.lte(databaseTimestamp(inactiveUntil)),
			),
		)
			.select("id", "lastActiveAt")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findOnboardingCandidates(params: {
		tz: string;
		createdSince: Date;
	}): Promise<OnboardingCandidate[]> {
		const { tz, createdSince } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				this.#recentTreatmentExclusion(row),
				row.createdAt.gte(databaseTimestamp(createdSince)),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
			),
		)
			.select("id", "createdAt")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]> {
		const counts = await this.database.db.orm.public.Todo.where((row) =>
			and(row.userId.in(userIds), row.completed.eq(true)),
		)
			.groupBy("userId")
			.aggregate((aggregate) => ({ count: aggregate.count() }))
			.then((rows) =>
				rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
			);
		return counts.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async findActiveUsersInTimezone(tz: string): Promise<UserIdRow[]> {
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.deletedAt.isNull(),
				this.#recentTreatmentExclusion(row),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
			),
		)
			.select("id")
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findNudgeSuggestFollows(params: {
		candidateIds: string[];
		activeSince: Date;
		activeUntil: Date;
	}): Promise<NudgeSuggestFollow[]> {
		const { candidateIds, activeSince, activeUntil } = params;
		return this.database.db.orm.public.Follow.where((row) =>
			or(
				and(
					row.followerId.in(candidateIds),
					row.status.eq("ACCEPTED"),
					row.following.some((related) =>
						and(
							related.lastActiveAt.gte(databaseTimestamp(activeSince)),
							related.lastActiveAt.lte(databaseTimestamp(activeUntil)),
						),
					),
				),
				and(
					row.followingId.in(candidateIds),
					row.status.eq("ACCEPTED"),
					row.follower.some((related) =>
						and(
							related.lastActiveAt.gte(databaseTimestamp(activeSince)),
							related.lastActiveAt.lte(databaseTimestamp(activeUntil)),
						),
					),
				),
			),
		)
			.select("followerId", "followingId")
			.include("follower", (related) =>
				related
					.select("id", "lastActiveAt")
					.include("profile", (related) => related.select("name")),
			)
			.include("following", (related) =>
				related
					.select("id", "lastActiveAt")
					.include("profile", (related) => related.select("name")),
			)
			.all()
			.then((rows) =>
				decodeRecord("Follow", rows).map((row) => ({
					...row,
					follower: requireRecord(row.follower),
					following: requireRecord(row.following),
				})),
			);
	}

	async findSocialDigestCandidates(
		params: SocialDigestCandidateParams,
	): Promise<SocialDigestCandidate[]> {
		const { tz, today, tomorrow, recipientUserIds } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.id.in([...recipientUserIds]),
				this.#recentTreatmentExclusion(row),
				row.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
						related.completed.eq(false),
					),
				),
			),
		)
			.select("id")
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.select("completed"),
			)
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]> {
		return this.database.db.orm.public.Follow.where((row) =>
			or(
				and(row.followerId.in(candidateIds), row.status.eq("ACCEPTED")),
				and(row.followingId.in(candidateIds), row.status.eq("ACCEPTED")),
			),
		)
			.select("followerId", "followingId")
			.all()
			.then((rows) => decodeRecord("Follow", rows));
	}

	async findFriendsWithTodayTodos(params: {
		friendIds: string[];
		today: Date;
		tomorrow: Date;
	}): Promise<FriendWithTodos[]> {
		const { friendIds, today, tomorrow } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				row.id.in(friendIds),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
					),
				),
			),
		)
			.select("id")
			.include("profile", (related) => related.select("name"))
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.select("completed"),
			)
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]> {
		const { tz, today, tomorrow } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				this.#recentTreatmentExclusion(row),
				row.preference.some((related) =>
					and(related.timezone.eq(varchar(tz, 50)), related.currentStreak.gte(3)),
				),
				row.todos.some((related) =>
					and(
						related.startDate.gte(databaseDate(today)),
						related.startDate.lt(databaseDate(tomorrow)),
						related.completed.eq(false),
					),
				),
			),
		)
			.select("id")
			.include("todos", (related) =>
				related
					.where((row) =>
						and(row.startDate.gte(databaseDate(today)), row.startDate.lt(databaseDate(tomorrow))),
					)
					.select("completed"),
			)
			.include("preference", (related) =>
				related.select("currentStreak", "lastCompletedDate", "locale"),
			)
			.all()
			.then((row) => decodeRecord("User", row));
	}

	// ─────────────────────────────────────────────────────────────
	// WeatherReminderReaderPort — 아침/저녁 날씨 알림
	// ─────────────────────────────────────────────────────────────

	async findWeatherMorningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				row.status.eq("ACTIVE"),
				row.deletedAt.isNull(),
				row.preference.some((related) =>
					and(
						related.weatherMorningEnabled.eq(true),
						related.timezone.eq(varchar(tz, 50)),
						related.weatherMorningHour.eq(hour),
						related.weatherMorningMinute.eq(minute),
					),
				),
				row.location.some(),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.include("location", (related) => related.select("latitude", "longitude", "gridX", "gridY"))
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findWeatherMorningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				row.status.eq("ACTIVE"),
				row.deletedAt.isNull(),
				row.preference.some((related) =>
					and(
						related.weatherMorningEnabled.eq(true),
						related.timezone.eq(varchar(tz, 50)),
						related.weatherMorningHour.eq(hour),
						related.weatherMorningMinute.eq(minute),
					),
				),
				row.location.none(),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findWeatherEveningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				row.status.eq("ACTIVE"),
				row.deletedAt.isNull(),
				row.preference.some((related) =>
					and(
						related.weatherEveningEnabled.eq(true),
						related.timezone.eq(varchar(tz, 50)),
						related.weatherEveningHour.eq(hour),
						related.weatherEveningMinute.eq(minute),
					),
				),
				row.location.some(),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.include("location", (related) => related.select("latitude", "longitude", "gridX", "gridY"))
			.all()
			.then((row) => decodeRecord("User", row));
	}

	async findWeatherEveningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.db.orm.public.User.where((row) =>
			and(
				userId ? row.id.eq(userId) : all(),
				row.status.eq("ACTIVE"),
				row.deletedAt.isNull(),
				row.preference.some((related) =>
					and(
						related.weatherEveningEnabled.eq(true),
						related.timezone.eq(varchar(tz, 50)),
						related.weatherEveningHour.eq(hour),
						related.weatherEveningMinute.eq(minute),
					),
				),
				row.location.none(),
			),
		)
			.select("id")
			.include("preference", (related) => related.select("locale"))
			.all()
			.then((row) => decodeRecord("User", row));
	}

	// ─────────────────────────────────────────────────────────────
	// WeeklyAchievementStatsReaderPort — 주간 달성 집계
	// ─────────────────────────────────────────────────────────────

	async groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
		const { tz, periodStart, periodEnd } = params;
		const rows = await this.database.db.orm.public.Todo.where((row) =>
			and(
				row.startDate.gte(databaseDate(periodStart)),
				row.startDate.lt(databaseDate(periodEnd)),
				row.user.some((related) =>
					related.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				),
			),
		)
			.groupBy("userId")
			.aggregate((aggregate) => ({ count: aggregate.count() }))
			.then((rows) =>
				rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
			);
		return rows.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
		const { tz, periodStart, periodEnd } = params;
		const rows = await this.database.db.orm.public.Todo.where((row) =>
			and(
				row.startDate.gte(databaseDate(periodStart)),
				row.startDate.lt(databaseDate(periodEnd)),
				row.completed.eq(true),
				row.user.some((related) =>
					related.preference.some((related) => related.timezone.eq(varchar(tz, 50))),
				),
			),
		)
			.groupBy("userId")
			.aggregate((aggregate) => ({ count: aggregate.count() }))
			.then((rows) =>
				rows.map((row) => ({ ...decodeRecord("Todo", row), _count: { id: row.count } })),
			);
		return rows.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
		if (userIds.length === 0) return new Set();
		const rows = decodeRecord(
			"User",
			await this.database.db.orm.public.User.where((row) =>
				and(row.id.in(userIds), row.subscriptionStatus.neq("ACTIVE"), row.role.neq("ADMIN")),
			)
				.select("id")
				.all(),
		);
		return new Set(rows.map((row) => row.id));
	}

	// ─────────────────────────────────────────────────────────────
	// TodoReminderReaderPort — 지연 잡 처리용
	// ─────────────────────────────────────────────────────────────

	async findActiveTodo(todoId: number): Promise<ActiveTodo | null> {
		return this.database.db.orm.public.Todo.where((row) =>
			and(row.id.eq(todoId), row.completed.eq(false)),
		)
			.select("id", "title")
			.first()
			.then((row) => decodeRecord("Todo", row));
	}

	async existsRecentReminderNotification(params: {
		todoId: number;
		since: Date;
		stage: string;
	}): Promise<boolean> {
		const { todoId, since, stage } = params;
		const existing = await this.database.db.orm.public.Notification.where((row) =>
			and(
				row.todoId.eq(todoId),
				row._type.eq("TODO_REMINDER"),
				row.createdAt.gte(databaseTimestamp(since)),
			),
		)
			.where((row) =>
				this.database.db.raw.sql`${row.metadata} ->> 'stage' = ${stage}`
					.returns("pg/bool@1")
					.buildAst(),
			)
			.select("id")
			.first();
		return existing !== null;
	}

	// ─────────────────────────────────────────────────────────────
	// SchedulerPreferenceReaderPort — 활성 타임존·푸시 로케일
	// ─────────────────────────────────────────────────────────────

	async findActiveTimezones(): Promise<string[]> {
		return this.cacheService.wrapActiveTimezones(async () => {
			const rows = await this.database.db.orm.public.UserPreference.groupBy("timezone").aggregate(
				(aggregate) => ({ count: aggregate.count() }),
			);
			return rows.flatMap((row) =>
				normalizeIanaTimezone(row.timezone) !== null ? [row.timezone] : [],
			);
		});
	}

	async findUserLocales(userIds: string[]): Promise<UserLocaleMap> {
		if (userIds.length === 0) {
			return new Map();
		}
		const preferences = decodeRecord(
			"UserPreference",
			await this.database.db.orm.public.UserPreference.where((row) => row.userId.in(userIds))
				.select("userId", "locale")
				.all(),
		);
		return new Map(
			preferences.map((preference) => [preference.userId, toSupportedLocale(preference.locale)]),
		);
	}

	/** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
	#recentTreatmentExclusion(user: ModelAccessor<Contract, "User", "public">) {
		if (!this.config.retentionOnboardingV2.enabled) return all();
		return user.retentionAssignments.none((assignment) =>
			and(
				assignment.experimentKey.eq(varchar("onboarding_v2_d7", 100)),
				assignment.variant.eq("TREATMENT"),
				assignment.startedAt.gte(databaseTimestamp(subtractDays(8))),
			),
		);
	}
}
