import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";
import { diffInDays } from "@/common/date/utils/compare";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import type { CreateNotificationData } from "@/modules/notification/types/notification.types";
import {
	type ReminderHourChangedJobData,
	TimezoneReminderProcessor,
	TimezoneReminderQueueService,
} from "../queue";

/**
 * 타임존 인식 리마인더 — Every-Minute Sweep 패턴
 *
 * 매분 실행되어 각 타임존별 로컬 시간(시:분)을 확인하고,
 * 해당 시간에 아침/저녁 리마인더를 원하는 사용자에게 알림을 발송합니다.
 *
 * BullMQ Job Scheduler를 사용하여 Redis에 스케줄을 저장합니다.
 * 리마인더 시간 변경 핸들러는 TimezoneReminderProcessor에서 호출됩니다.
 */
@Injectable()
export class TimezoneAwareReminderJob implements OnModuleInit {
	readonly #logger = new Logger(TimezoneAwareReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly queueService: TimezoneReminderQueueService,
		private readonly processor: TimezoneReminderProcessor,
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setReminderJob(this);

		await this.queueService.registerSweepScheduler();
	}

	/**
	 * 매분 실행 — Every-Minute Sweep 패턴
	 *
	 * 1. DB에서 활성화된 고유 타임존 목록 조회 (1 query)
	 * 2. 각 타임존의 현재 로컬 시간(시:분) 확인
	 * 3. 해당 시간에 아침/저녁 리마인더를 원하는 사용자에게 발송
	 */
	async handleHourlySweep(): Promise<void> {
		this.#logger.log("Starting every-minute sweep reminder job...");

		try {
			const now = new Date();

			// 1. 고유 타임존 목록 조회 (pushEnabled=true인 사용자만)
			const timezones = await this.database.userPreference.findMany({
				where: { pushEnabled: true },
				select: { timezone: true },
				distinct: ["timezone"],
			});

			// 2. 각 타임존별 아침/저녁 리마인더를 병렬 처리
			const tasks = timezones.map(({ timezone: tz }) => {
				const local = dayjs(now).tz(tz);
				const localHour = local.hour();
				const localMinute = local.minute();
				return this.#processTimezone(tz, localHour, localMinute);
			});

			const results = await Promise.allSettled(tasks);
			results.forEach((result, index) => {
				if (result.status === "rejected") {
					const tz = timezones[index]?.timezone ?? "unknown";
					this.#logger.error(
						`Timezone reminder task failed for tz=${tz}: ${result.reason}`,
						result.reason instanceof Error ? result.reason.stack : undefined,
					);
				}
			});

			this.#logger.log("Every-minute sweep reminder job completed");
		} catch (error) {
			this.#logger.error(
				`Sweep reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 리마인더 시간 변경 핸들러 — Catch-up 패턴
	 *
	 * 사용자가 리마인더 시간을 변경했을 때, 변경된 시간이 현재 로컬 시간과
	 * 같으면 즉시 리마인더를 발송합니다. (크론이 이미 실행된 후 변경한 경우 보완)
	 *
	 * 중복 방지: `notificationDate` 기반이므로 크론에서 이미 발송했으면 스킵됩니다.
	 */
	async handleReminderHourChanged(
		payload: ReminderHourChangedJobData,
	): Promise<void> {
		try {
			const now = dayjs().tz(payload.timezone);
			const localHour = now.hour();
			const localMinute = now.minute();

			const morningMinute = payload.morningReminderMinute ?? 0;
			if (
				payload.morningReminderHour !== undefined &&
				payload.morningReminderHour === localHour &&
				morningMinute === localMinute
			) {
				this.#logger.log(
					`Catch-up morning reminder for user=${payload.userId}, time=${localHour}:${String(localMinute).padStart(2, "0")}`,
				);
				await this.#sendMorningReminders(
					payload.timezone,
					localHour,
					localMinute,
					payload.userId,
				);
			}

			const eveningMinute = payload.eveningReminderMinute ?? 0;
			if (
				payload.eveningReminderHour !== undefined &&
				payload.eveningReminderHour === localHour &&
				eveningMinute === localMinute
			) {
				this.#logger.log(
					`Catch-up evening reminder for user=${payload.userId}, time=${localHour}:${String(localMinute).padStart(2, "0")}`,
				);
				await this.#sendEveningReminders(
					payload.timezone,
					localHour,
					localMinute,
					payload.userId,
				);
			}
		} catch (error) {
			this.#logger.error(
				`Catch-up reminder failed for user=${payload.userId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * Social Digest delayed job 핸들러
	 *
	 * 저녁 리마인더 30분 후 실행.
	 * 본인 미완료 + 오늘 전체 완료한 친구 존재 시 알림 발송.
	 */
	async handleSocialDigest(payload: { timezone: string }): Promise<void> {
		try {
			await this.#sendSocialDigest(payload.timezone);
		} catch (error) {
			this.#logger.error(
				`Social digest failed: tz=${payload.timezone}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #processTimezone(
		tz: string,
		localHour: number,
		localMinute: number,
	): Promise<void> {
		const local = dayjs().tz(tz);
		const dayOfWeek = local.day(); // 0=일, 1=월

		await this.#sendMorningReminders(tz, localHour, localMinute);
		const eveningSent = await this.#sendEveningReminders(
			tz,
			localHour,
			localMinute,
		);

		// 저녁 리마인더 발송 시 30분 후 Social Digest delayed job 등록
		if (eveningSent) {
			this.queueService.enqueueSocialDigest({ timezone: tz });
		}

		// 월요일 아침: 주간 리포트 (아침 리마인더와 같은 시간)
		if (dayOfWeek === 1) {
			await this.#sendWeeklyReport(tz, localHour, localMinute);
		}

		// 일요일 저녁: 주간 달성 배지 (저녁 리마인더와 같은 시간)
		if (dayOfWeek === 0) {
			await this.#sendWeeklyAchievement(tz, localHour, localMinute);
		}

		// 로컬 12:00: Win-back
		if (localHour === 12 && localMinute === 0) {
			await this.#sendWinbackReminders(tz);
		}

		// 로컬 14:00: 콕 찌르기 유도
		if (localHour === 14 && localMinute === 0) {
			await this.#sendNudgeSuggestions(tz);
		}
	}

	async #sendMorningReminders(
		tz: string,
		localHour: number,
		localMinute: number,
		userId?: string,
	): Promise<void> {
		const today = todayInTimezone(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const selectClause = {
			id: true,
			_count: {
				select: {
					todos: {
						where: {
							startDate: {
								gte: today,
								lt: tomorrow,
							},
						},
					},
				},
			},
		} as const;

		// 프리미엄 사용자: 커스텀 시간에 리마인더 발송
		const premiumUsers = await this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					pushEnabled: true,
					morningReminderHour: localHour,
					morningReminderMinute: localMinute,
				},
			},
			select: selectClause,
		});

		// 무료 사용자: 고정 시간(08:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
		const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
		const isFreeReminderTime =
			localHour === defaultHour && localMinute === defaultMinute;

		let freeUsers: typeof premiumUsers = [];
		if (!userId && isFreeReminderTime) {
			freeUsers = await this.database.user.findMany({
				where: {
					subscriptionStatus: { not: "ACTIVE" },
					role: { not: "ADMIN" },
					preference: {
						timezone: tz,
						pushEnabled: true,
					},
				},
				select: selectClause,
			});
		}

		const users = [...premiumUsers, ...freeUsers];

		if (users.length === 0) return;

		// 중복 방지: 이미 오늘 아침 리마인더를 받은 사용자 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "MORNING_REMINDER",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return;

		const notifications = filteredUsers.map((user) => {
			const count = user._count.todos;
			const message =
				count > 0
					? NotificationMessageBuilder.morningReminder(count)
					: NotificationMessageBuilder.morningNoTodo();

			return {
				userId: user.id,
				type: "MORNING_REMINDER" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Morning reminder: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, count=${notifications.length}`,
		);
	}

	async #sendEveningReminders(
		tz: string,
		localHour: number,
		localMinute: number,
		userId?: string,
	): Promise<boolean> {
		const today = todayInTimezone(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();
		const yesterday = dayjs.utc(today).subtract(1, "day").toDate();

		const selectClause = {
			id: true,
			todos: {
				where: {
					startDate: {
						gte: today,
						lt: tomorrow,
					},
				},
				select: {
					completed: true,
				},
			},
			preference: {
				select: {
					currentStreak: true,
					lastCompletedDate: true,
				},
			},
		} as const;

		// 프리미엄 사용자: 커스텀 시간에 리마인더 발송
		const premiumUsers = await this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					pushEnabled: true,
					eveningReminderHour: localHour,
					eveningReminderMinute: localMinute,
				},
				todos: {
					some: {
						startDate: {
							gte: today,
							lt: tomorrow,
						},
					},
				},
			},
			select: selectClause,
		});

		// 무료 사용자: 고정 시간(18:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
		const defaultHour = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE;
		const isFreeReminderTime =
			localHour === defaultHour && localMinute === defaultMinute;

		let freeUsers: typeof premiumUsers = [];
		if (!userId && isFreeReminderTime) {
			freeUsers = await this.database.user.findMany({
				where: {
					subscriptionStatus: { not: "ACTIVE" },
					role: { not: "ADMIN" },
					preference: {
						timezone: tz,
						pushEnabled: true,
					},
					todos: {
						some: {
							startDate: {
								gte: today,
								lt: tomorrow,
							},
						},
					},
				},
				select: selectClause,
			});
		}

		const users = [...premiumUsers, ...freeUsers];

		if (users.length === 0) return false;

		// 중복 방지: 이미 오늘 저녁 리마인더를 받은 사용자 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "EVENING_REMINDER",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return false;

		const notifications = filteredUsers.map((user) => {
			const total = user.todos.length;
			const completed = user.todos.filter((t) => t.completed).length;

			// 스트릭 정보 계산
			const pref = user.preference;
			const currentStreak = pref?.currentStreak ?? 0;
			const lastCompleted = pref?.lastCompletedDate;

			// 오늘 전체 완료 시: 오늘의 스트릭은 currentStreak + 1 (아직 반영 안 됐을 수 있으므로)
			// StreakService에서 이미 반영했을 수도 있고 아닐 수도 있음
			// lastCompletedDate가 오늘이면 이미 반영됨 → currentStreak 그대로
			// lastCompletedDate가 어제면 아직 미반영 → currentStreak + 1
			let streak = currentStreak;
			if (completed === total && total > 0) {
				const isAlreadyUpdatedToday =
					lastCompleted &&
					dayjs.utc(lastCompleted).isSame(dayjs.utc(today), "day");
				const isYesterday =
					lastCompleted &&
					dayjs.utc(lastCompleted).isSame(dayjs.utc(yesterday), "day");

				if (isAlreadyUpdatedToday) {
					streak = currentStreak; // 이미 반영됨
				} else if (isYesterday) {
					streak = currentStreak + 1; // sweep 시점에 아직 미반영
				} else {
					streak = 1; // 연속 끊김
				}
			}

			// 스트릭 위기: 어제까지 연속 완료했지만 오늘 미완료
			const isStreakAtRisk =
				completed < total &&
				currentStreak >= 2 &&
				!!lastCompleted &&
				dayjs.utc(lastCompleted).isSame(dayjs.utc(yesterday), "day");

			const message = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
				streak,
				isStreakAtRisk,
			);

			return {
				userId: user.id,
				type: "EVENING_REMINDER" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Evening reminder: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, count=${notifications.length}`,
		);
		return true;
	}

	/**
	 * Win-back 알림 — 로컬 12:00에 비활성 유저에게 발송
	 *
	 * 3일/7일/14일 미접속 단계별 메시지. 14일 초과 시 발송 중단.
	 */
	async #sendWinbackReminders(tz: string): Promise<void> {
		const today = todayInTimezone(tz);

		// 3~15일 전 사이 lastActiveAt인 유저 조회
		const cutoffStart = dayjs.utc(today).subtract(15, "day").toDate();
		const cutoffEnd = dayjs.utc(today).subtract(3, "day").toDate();

		const users = await this.database.user.findMany({
			where: {
				deletedAt: null,
				lastActiveAt: { gte: cutoffStart, lte: cutoffEnd },
				preference: { timezone: tz, pushEnabled: true },
			},
			select: { id: true, lastActiveAt: true },
		});

		if (users.length === 0) return;

		// 중복 방지: 이미 오늘 WINBACK 발송한 유저 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WINBACK",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return;

		// 단계별 중복 방지: 같은 단계 이미 발송했는지 체크
		const notifications: CreateNotificationData[] = [];

		for (const user of filteredUsers) {
			if (!user.lastActiveAt) continue;

			const inactiveDays = diffInDays(today, user.lastActiveAt);
			let stage: string;
			if (inactiveDays >= 14) stage = "day14";
			else if (inactiveDays >= 7) stage = "day7";
			else stage = "day3";

			// 같은 단계 이미 발송했는지 확인
			const alreadySentStage =
				await this.notificationService.hasNotificationWithMetadata(
					user.id,
					"WINBACK",
					["stage"],
					stage,
				);
			if (alreadySentStage) continue;

			const message = NotificationMessageBuilder.winback(inactiveDays);
			notifications.push({
				userId: user.id,
				type: "WINBACK",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { stage },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(`Winback: tz=${tz}, count=${notifications.length}`);
		}
	}

	/**
	 * 주간 리포트 — 월요일 아침 리마인더 시간에 발송
	 */
	async #sendWeeklyReport(
		tz: string,
		localHour: number,
		localMinute: number,
	): Promise<void> {
		const today = todayInTimezone(tz);
		const weekAgo = dayjs.utc(today).subtract(7, "day").toDate();

		// 프리미엄: 커스텀 시간, 무료: 08:00
		const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
		const isFreeTime =
			localHour === defaultHour && localMinute === defaultMinute;

		const premiumUsers = await this.database.user.findMany({
			where: {
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					pushEnabled: true,
					morningReminderHour: localHour,
					morningReminderMinute: localMinute,
				},
				todos: { some: { startDate: { gte: weekAgo, lt: today } } },
			},
			select: { id: true },
		});

		let freeUsers: typeof premiumUsers = [];
		if (isFreeTime) {
			freeUsers = await this.database.user.findMany({
				where: {
					subscriptionStatus: { not: "ACTIVE" },
					role: { not: "ADMIN" },
					preference: { timezone: tz, pushEnabled: true },
					todos: { some: { startDate: { gte: weekAgo, lt: today } } },
				},
				select: { id: true },
			});
		}

		const users = [...premiumUsers, ...freeUsers];
		if (users.length === 0) return;

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WEEKLY_REPORT",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return;

		const message = NotificationMessageBuilder.weeklyReport();
		const notifications = filteredUsers.map((user) => ({
			userId: user.id,
			type: "WEEKLY_REPORT" as const,
			title: message.title,
			body: message.body,
			notificationDate: today,
		}));

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(`Weekly report: tz=${tz}, count=${notifications.length}`);
	}

	/**
	 * 주간 달성 배지 — 일요일 저녁 리마인더 시간에 발송
	 */
	async #sendWeeklyAchievement(
		tz: string,
		localHour: number,
		localMinute: number,
	): Promise<void> {
		const today = todayInTimezone(tz);
		// 이번 주 월~일 (월요일 시작)
		const mondayOfWeek = dayjs.utc(today).subtract(6, "day").toDate();
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const defaultHour = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR;
		const defaultMinute = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE;
		const isFreeTime =
			localHour === defaultHour && localMinute === defaultMinute;

		const selectClause = {
			id: true,
			_count: {
				select: {
					todos: {
						where: {
							startDate: { gte: mondayOfWeek, lt: tomorrow },
						},
					},
				},
			},
		} as const;

		const premiumUsers = await this.database.user.findMany({
			where: {
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					pushEnabled: true,
					eveningReminderHour: localHour,
					eveningReminderMinute: localMinute,
				},
				todos: {
					some: {
						startDate: { gte: mondayOfWeek, lt: tomorrow },
						completed: true,
					},
				},
			},
			select: selectClause,
		});

		let freeUsers: typeof premiumUsers = [];
		if (isFreeTime) {
			freeUsers = await this.database.user.findMany({
				where: {
					subscriptionStatus: { not: "ACTIVE" },
					role: { not: "ADMIN" },
					preference: { timezone: tz, pushEnabled: true },
					todos: {
						some: {
							startDate: { gte: mondayOfWeek, lt: tomorrow },
							completed: true,
						},
					},
				},
				select: selectClause,
			});
		}

		const users = [...premiumUsers, ...freeUsers];
		if (users.length === 0) return;

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WEEKLY_ACHIEVEMENT",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return;

		// 완료 수 집계를 위해 개별 쿼리
		const notifications = await Promise.all(
			filteredUsers.map(async (user) => {
				const totalCount = user._count.todos;
				const completedCount = await this.database.todo.count({
					where: {
						userId: user.id,
						startDate: { gte: mondayOfWeek, lt: tomorrow },
						completed: true,
					},
				});

				const message = NotificationMessageBuilder.weeklyAchievement(
					completedCount,
					totalCount,
				);

				return {
					userId: user.id,
					type: "WEEKLY_ACHIEVEMENT" as const,
					title: message.title,
					body: message.body,
					notificationDate: today,
				};
			}),
		);

		await this.notificationService.createAndSendBatch(notifications);
		this.#logger.log(
			`Weekly achievement: tz=${tz}, count=${notifications.length}`,
		);
	}

	/**
	 * 콕 찌르기 유도 — 로컬 14:00에 발송
	 *
	 * 맞팔 친구 중 2~7일 비활성인 친구가 있을 때,
	 * 주 1회 / 하루 1명 제한으로 콕 찌르기를 유도합니다.
	 */
	async #sendNudgeSuggestions(tz: string): Promise<void> {
		const today = todayInTimezone(tz);
		const weekAgo = dayjs.utc(today).subtract(7, "day").toDate();
		const twoDaysAgo = dayjs.utc(today).subtract(2, "day").toDate();

		// 이 타임존에서 pushEnabled인 유저 목록
		const activeUsers = await this.database.user.findMany({
			where: {
				deletedAt: null,
				preference: { timezone: tz, pushEnabled: true },
			},
			select: { id: true },
		});

		if (activeUsers.length === 0) return;

		// 이미 오늘 NUDGE_SUGGEST 받은 유저 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: activeUsers.map((u) => u.id),
				type: "NUDGE_SUGGEST",
				notificationDate: today,
			});

		const candidates = activeUsers.filter((u) => !alreadyNotified.has(u.id));
		if (candidates.length === 0) return;

		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			// 맞팔 친구 중 2~7일 비활성인 친구 찾기
			const inactiveFriends = await this.database.follow.findMany({
				where: {
					OR: [
						{
							followerId: user.id,
							status: "ACCEPTED",
							following: {
								lastActiveAt: { gte: weekAgo, lte: twoDaysAgo },
							},
						},
						{
							followingId: user.id,
							status: "ACCEPTED",
							follower: {
								lastActiveAt: { gte: weekAgo, lte: twoDaysAgo },
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

			if (inactiveFriends.length === 0) continue;

			// 친구 정보 추출 (자신이 아닌 쪽)
			const friends = inactiveFriends.map((f) => {
				const friend = f.followerId === user.id ? f.following : f.follower;
				return {
					id: friend.id,
					name: friend.profile?.name ?? "친구",
					lastActiveAt: friend.lastActiveAt,
				};
			});

			// 이번 주 이미 해당 친구에게 NUDGE_SUGGEST 발송했는지 체크
			const thisWeekNotifications = await this.database.notification.findMany({
				where: {
					userId: user.id,
					type: "NUDGE_SUGGEST",
					notificationDate: { gte: weekAgo },
				},
				select: { metadata: true },
			});

			const sentFriendIds = new Set(
				thisWeekNotifications
					.map((n) => {
						const meta = n.metadata as Record<string, unknown> | null;
						return meta?.friendId as string | undefined;
					})
					.filter(Boolean),
			);

			// 이번 주 미발송 + 비활성 일수 가장 긴 친구 선택
			const eligibleFriends = friends
				.filter((f) => !sentFriendIds.has(f.id))
				.sort((a, b) => {
					const daysA = a.lastActiveAt ? diffInDays(today, a.lastActiveAt) : 0;
					const daysB = b.lastActiveAt ? diffInDays(today, b.lastActiveAt) : 0;
					return daysB - daysA;
				});

			const target = eligibleFriends[0];
			if (!target || !target.lastActiveAt) continue;

			const days = diffInDays(today, target.lastActiveAt);
			const message = NotificationMessageBuilder.nudgeSuggest(
				target.name,
				days,
			);

			notifications.push({
				userId: user.id,
				type: "NUDGE_SUGGEST",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { friendId: target.id },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(
				`Nudge suggest: tz=${tz}, count=${notifications.length}`,
			);
		}
	}

	/**
	 * Social Digest — 저녁 리마인더 30분 후 발송
	 *
	 * 조건: 본인 오늘 미완료 + 오늘 전체 완료한 맞팔 친구 1명 이상
	 */
	async #sendSocialDigest(tz: string): Promise<void> {
		const today = todayInTimezone(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		// pushEnabled + 해당 타임존 + 오늘 투두 미완료인 유저 조회
		const users = await this.database.user.findMany({
			where: {
				preference: { timezone: tz, pushEnabled: true },
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

		// 전체 완료한 유저 제외 (본인 미완료 조건)
		const incompleteUsers = users.filter((u) =>
			u.todos.some((t) => !t.completed),
		);
		if (incompleteUsers.length === 0) return;

		// 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: incompleteUsers.map((u) => u.id),
				type: "SOCIAL_DIGEST",
				notificationDate: today,
			});

		const candidates = incompleteUsers.filter(
			(u) => !alreadyNotified.has(u.id),
		);
		if (candidates.length === 0) return;

		const notifications: CreateNotificationData[] = [];

		for (const user of candidates) {
			// 맞팔 친구 중 오늘 전체 완료한 친구 조회
			const follows = await this.database.follow.findMany({
				where: {
					OR: [
						{ followerId: user.id, status: "ACCEPTED" },
						{ followingId: user.id, status: "ACCEPTED" },
					],
				},
				select: { followerId: true, followingId: true },
			});

			const friendIds = follows.map((f) =>
				f.followerId === user.id ? f.followingId : f.followerId,
			);
			if (friendIds.length === 0) continue;

			// 오늘 전체 완료한 친구들 (투두 있고 미완료 없는)
			const friendsWithTodos = await this.database.user.findMany({
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

			const completedFriends = friendsWithTodos.filter(
				(f) => f.todos.length > 0 && f.todos.every((t) => t.completed),
			);
			if (completedFriends.length === 0) continue;

			const friendName =
				completedFriends.length === 1
					? (completedFriends[0]?.profile?.name ?? "친구")
					: undefined;

			const message = NotificationMessageBuilder.socialDigest(
				completedFriends.length,
				friendName,
			);

			notifications.push({
				userId: user.id,
				type: "SOCIAL_DIGEST",
				title: message.title,
				body: message.body,
				notificationDate: today,
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(
				`Social digest: tz=${tz}, count=${notifications.length}`,
			);
		}
	}
}
