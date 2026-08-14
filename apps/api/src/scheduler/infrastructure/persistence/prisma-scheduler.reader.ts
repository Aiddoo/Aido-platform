import { Injectable } from "@nestjs/common";

import type { Prisma } from "@/generated/prisma/client";
import { resolveTemplateLocale } from "@/notification";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { normalizeIanaTimezone } from "@/shared/domain/date/utils/timezone";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	InactiveWindowParams,
	ReEngagementReaderPort,
	SocialDigestCandidateParams,
	TodayRangeParams,
} from "../../application/ports/re-engagement-reader.port";
import type {
	CustomTimeReminderParams,
	FixedTimeReminderParams,
	PeriodReportParams,
	ScheduledReminderReaderPort,
} from "../../application/ports/scheduled-reminder-reader.port";
import type { SchedulerPreferenceReaderPort } from "../../application/ports/scheduler-preference-reader.port";
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
} from "../../application/ports/scheduler-read-models";
import type { TodoReminderReaderPort } from "../../application/ports/todo-reminder-reader.port";
import type {
	WeatherReminderParams,
	WeatherReminderReaderPort,
} from "../../application/ports/weather-reminder-reader.port";
import type {
	WeeklyAchievementStatsReaderPort,
	WeeklyStatsParams,
} from "../../application/ports/weekly-achievement-stats-reader.port";

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
		return this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					morningReminderHour: hour,
					morningReminderMinute: minute,
				},
			},
			select: {
				id: true,
				preference: { select: { locale: true } },
				_count: {
					select: {
						todos: { where: { startDate: { gte: today, lt: tomorrow } } },
					},
				},
			},
		});
	}

	async findFreeMorningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<ReminderCountUser[]> {
		const { tz, today, tomorrow } = params;
		return this.database.user.findMany({
			where: {
				subscriptionStatus: { not: "ACTIVE" },
				role: { not: "ADMIN" },
				preference: { timezone: tz },
			},
			select: {
				id: true,
				preference: { select: { locale: true } },
				_count: {
					select: {
						todos: { where: { startDate: { gte: today, lt: tomorrow } } },
					},
				},
			},
		});
	}

	async findPremiumEveningReminderUsers(
		params: CustomTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]> {
		const { tz, hour, minute, today, tomorrow, userId } = params;
		return this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					eveningReminderHour: hour,
					eveningReminderMinute: minute,
				},
				todos: { some: { startDate: { gte: today, lt: tomorrow } } },
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
				preference: {
					select: {
						currentStreak: true,
						lastCompletedDate: true,
						locale: true,
					},
				},
			},
		});
	}

	async findFreeEveningReminderUsers(
		params: FixedTimeReminderParams,
	): Promise<UserWithTodosAndStreak[]> {
		const { tz, today, tomorrow } = params;
		return this.database.user.findMany({
			where: {
				subscriptionStatus: { not: "ACTIVE" },
				role: { not: "ADMIN" },
				preference: { timezone: tz },
				todos: { some: { startDate: { gte: today, lt: tomorrow } } },
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
				preference: {
					select: {
						currentStreak: true,
						lastCompletedDate: true,
						locale: true,
					},
				},
			},
		});
	}

	async findLunchNudgeUsers(params: FixedTimeReminderParams): Promise<UserIdRow[]> {
		const { tz, today, tomorrow } = params;
		return this.database.user.findMany({
			where: {
				...this.#recentTreatmentExclusion(),
				preference: { timezone: tz },
				todos: {
					some: { startDate: { gte: today, lt: tomorrow } },
					none: {
						startDate: { gte: today, lt: tomorrow },
						completed: true,
					},
				},
			},
			select: { id: true },
		});
	}

	async findWeeklyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
		const { tz, periodStart, periodEnd } = params;
		return this.database.user.findMany({
			where: {
				preference: { timezone: tz },
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				todos: { some: { startDate: { gte: periodStart, lt: periodEnd } } },
			},
			select: { id: true },
		});
	}

	async findMonthlyReportRecipients(params: PeriodReportParams): Promise<UserIdRow[]> {
		const { tz, periodStart, periodEnd } = params;
		return this.database.user.findMany({
			where: {
				preference: { timezone: tz },
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				todos: { some: { startDate: { gte: periodStart, lt: periodEnd } } },
			},
			select: { id: true },
		});
	}

	// ─────────────────────────────────────────────────────────────
	// ReEngagementReaderPort — winback·온보딩·넛지추천·소셜다이제스트·스트릭
	// ─────────────────────────────────────────────────────────────

	async findWinbackUsers(params: InactiveWindowParams): Promise<WinbackUser[]> {
		const { tz, inactiveSince, inactiveUntil } = params;
		return this.database.user.findMany({
			where: {
				...this.#recentTreatmentExclusion(),
				preference: { timezone: tz },
				lastActiveAt: { gte: inactiveSince, lte: inactiveUntil },
			},
			select: { id: true, lastActiveAt: true },
		});
	}

	async findOnboardingCandidates(params: {
		tz: string;
		createdSince: Date;
	}): Promise<OnboardingCandidate[]> {
		const { tz, createdSince } = params;
		return this.database.user.findMany({
			where: {
				...this.#recentTreatmentExclusion(),
				createdAt: { gte: createdSince },
				preference: { timezone: tz },
			},
			select: { id: true, createdAt: true },
		});
	}

	async countCompletedTodosByUsers(userIds: string[]): Promise<UserTodoCount[]> {
		const counts = await this.database.todo.groupBy({
			by: ["userId"],
			where: { userId: { in: userIds }, completed: true },
			_count: { id: true },
		});
		return counts.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async findActiveUsersInTimezone(tz: string): Promise<UserIdRow[]> {
		return this.database.user.findMany({
			where: {
				deletedAt: null,
				...this.#recentTreatmentExclusion(),
				preference: { timezone: tz },
			},
			select: { id: true },
		});
	}

	async findNudgeSuggestFollows(params: {
		candidateIds: string[];
		activeSince: Date;
		activeUntil: Date;
	}): Promise<NudgeSuggestFollow[]> {
		const { candidateIds, activeSince, activeUntil } = params;
		return this.database.follow.findMany({
			where: {
				OR: [
					{
						followerId: { in: candidateIds },
						status: "ACCEPTED",
						following: {
							lastActiveAt: { gte: activeSince, lte: activeUntil },
						},
					},
					{
						followingId: { in: candidateIds },
						status: "ACCEPTED",
						follower: {
							lastActiveAt: { gte: activeSince, lte: activeUntil },
						},
					},
				],
			},
			select: {
				followerId: true,
				followingId: true,
				follower: {
					select: {
						id: true,
						lastActiveAt: true,
						profile: { select: { name: true } },
					},
				},
				following: {
					select: {
						id: true,
						lastActiveAt: true,
						profile: { select: { name: true } },
					},
				},
			},
		});
	}

	async findSocialDigestCandidates(
		params: SocialDigestCandidateParams,
	): Promise<SocialDigestCandidate[]> {
		const { tz, today, tomorrow, recipientUserIds } = params;
		return this.database.user.findMany({
			where: {
				id: { in: [...recipientUserIds] },
				...this.#recentTreatmentExclusion(),
				preference: { timezone: tz },
				todos: {
					some: {
						startDate: { gte: today, lt: tomorrow },
						completed: false,
					},
				},
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
			},
		});
	}

	async findAcceptedFollows(candidateIds: string[]): Promise<FollowPair[]> {
		return this.database.follow.findMany({
			where: {
				OR: [
					{ followerId: { in: candidateIds }, status: "ACCEPTED" },
					{ followingId: { in: candidateIds }, status: "ACCEPTED" },
				],
			},
			select: { followerId: true, followingId: true },
		});
	}

	async findFriendsWithTodayTodos(params: {
		friendIds: string[];
		today: Date;
		tomorrow: Date;
	}): Promise<FriendWithTodos[]> {
		const { friendIds, today, tomorrow } = params;
		return this.database.user.findMany({
			where: {
				id: { in: friendIds },
				todos: { some: { startDate: { gte: today, lt: tomorrow } } },
			},
			select: {
				id: true,
				profile: { select: { name: true } },
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
			},
		});
	}

	async findStreakAtRiskUsers(params: TodayRangeParams): Promise<UserWithTodosAndStreak[]> {
		const { tz, today, tomorrow } = params;
		return this.database.user.findMany({
			where: {
				...this.#recentTreatmentExclusion(),
				preference: { timezone: tz, currentStreak: { gte: 3 } },
				todos: {
					some: {
						startDate: { gte: today, lt: tomorrow },
						completed: false,
					},
				},
			},
			select: {
				id: true,
				todos: {
					where: { startDate: { gte: today, lt: tomorrow } },
					select: { completed: true },
				},
				preference: {
					select: {
						currentStreak: true,
						lastCompletedDate: true,
						locale: true,
					},
				},
			},
		});
	}

	// ─────────────────────────────────────────────────────────────
	// WeatherReminderReaderPort — 아침/저녁 날씨 알림
	// ─────────────────────────────────────────────────────────────

	async findWeatherMorningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.user.findMany({
			where: {
				...(userId ? { id: userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: {
					weatherMorningEnabled: true,
					timezone: tz,
					weatherMorningHour: hour,
					weatherMorningMinute: minute,
				},
				location: { isNot: null },
			},
			select: {
				id: true,
				preference: { select: { locale: true } },
				location: {
					select: {
						latitude: true,
						longitude: true,
						gridX: true,
						gridY: true,
					},
				},
			},
		});
	}

	async findWeatherMorningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.user.findMany({
			where: {
				...(userId ? { id: userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: {
					weatherMorningEnabled: true,
					timezone: tz,
					weatherMorningHour: hour,
					weatherMorningMinute: minute,
				},
				location: null,
			},
			select: { id: true, preference: { select: { locale: true } } },
		});
	}

	async findWeatherEveningUsersWithLocation(
		params: WeatherReminderParams,
	): Promise<WeatherReminderUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.user.findMany({
			where: {
				...(userId ? { id: userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: {
					weatherEveningEnabled: true,
					timezone: tz,
					weatherEveningHour: hour,
					weatherEveningMinute: minute,
				},
				location: { isNot: null },
			},
			select: {
				id: true,
				preference: { select: { locale: true } },
				location: {
					select: {
						latitude: true,
						longitude: true,
						gridX: true,
						gridY: true,
					},
				},
			},
		});
	}

	async findWeatherEveningFallbackUsers(
		params: WeatherReminderParams,
	): Promise<WeatherFallbackUser[]> {
		const { tz, hour, minute, userId } = params;
		return this.database.user.findMany({
			where: {
				...(userId ? { id: userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: {
					weatherEveningEnabled: true,
					timezone: tz,
					weatherEveningHour: hour,
					weatherEveningMinute: minute,
				},
				location: null,
			},
			select: { id: true, preference: { select: { locale: true } } },
		});
	}

	// ─────────────────────────────────────────────────────────────
	// WeeklyAchievementStatsReaderPort — 주간 달성 집계
	// ─────────────────────────────────────────────────────────────

	async groupTotalTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
		const { tz, periodStart, periodEnd } = params;
		const rows = await this.database.todo.groupBy({
			by: ["userId"],
			where: {
				startDate: { gte: periodStart, lt: periodEnd },
				user: { preference: { timezone: tz } },
			},
			_count: { id: true },
		});
		return rows.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async groupCompletedTodosByUser(params: WeeklyStatsParams): Promise<UserTodoCount[]> {
		const { tz, periodStart, periodEnd } = params;
		const rows = await this.database.todo.groupBy({
			by: ["userId"],
			where: {
				startDate: { gte: periodStart, lt: periodEnd },
				completed: true,
				user: { preference: { timezone: tz } },
			},
			_count: { id: true },
		});
		return rows.map((row) => ({ userId: row.userId, count: row._count.id }));
	}

	async findFreeRecipientIds(userIds: string[]): Promise<Set<string>> {
		if (userIds.length === 0) return new Set();
		const rows = await this.database.user.findMany({
			where: {
				id: { in: userIds },
				subscriptionStatus: { not: "ACTIVE" },
				role: { not: "ADMIN" },
			},
			select: { id: true },
		});
		return new Set(rows.map((row) => row.id));
	}

	// ─────────────────────────────────────────────────────────────
	// TodoReminderReaderPort — 지연 잡 처리용
	// ─────────────────────────────────────────────────────────────

	async findActiveTodo(todoId: number): Promise<ActiveTodo | null> {
		return this.database.todo.findFirst({
			where: { id: todoId, completed: false },
			select: { id: true, title: true },
		});
	}

	async existsRecentReminderNotification(params: {
		todoId: number;
		since: Date;
		stage: string;
	}): Promise<boolean> {
		const { todoId, since, stage } = params;
		const existing = await this.database.notification.findFirst({
			where: {
				todoId,
				type: "TODO_REMINDER",
				createdAt: { gte: since },
				metadata: { path: ["stage"], equals: stage },
			},
			select: { id: true },
		});
		return existing !== null;
	}

	// ─────────────────────────────────────────────────────────────
	// SchedulerPreferenceReaderPort — 활성 타임존·푸시 로케일
	// ─────────────────────────────────────────────────────────────

	async findActiveTimezones(): Promise<string[]> {
		return this.cacheService.wrapActiveTimezones(async () => {
			const rows = await this.database.userPreference.findMany({
				select: { timezone: true },
				distinct: ["timezone"],
			});
			return rows.flatMap((row) => (normalizeIanaTimezone(row.timezone) ? [row.timezone] : []));
		});
	}

	async findUserLocales(userIds: string[]): Promise<UserLocaleMap> {
		if (userIds.length === 0) {
			return new Map();
		}
		const preferences = await this.database.userPreference.findMany({
			where: { userId: { in: userIds } },
			select: { userId: true, locale: true },
		});
		return new Map(
			preferences.map((preference) => [
				preference.userId,
				resolveTemplateLocale(preference.locale),
			]),
		);
	}

	/** kill switch가 켜진 동안 최근 TREATMENT만 legacy engagement에서 제외한다. */
	#recentTreatmentExclusion(): Pick<Prisma.UserWhereInput, "retentionAssignments"> {
		if (!this.config.retentionOnboardingV2.enabled) return {};
		return {
			retentionAssignments: {
				none: {
					experimentKey: "onboarding_v2_d7",
					variant: "TREATMENT",
					startedAt: { gte: subtractDays(8) },
				},
			},
		};
	}
}
