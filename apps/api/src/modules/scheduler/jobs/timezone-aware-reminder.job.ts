import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron } from "@nestjs/schedule";
import dayjs from "dayjs";
import { getUserToday } from "@/common/date/utils/date.util";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import type { ReminderHourChangedEventPayload } from "@/modules/notification/events/notification.events";
import { NotificationEvents } from "@/modules/notification/events/notification.events";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

/**
 * 타임존 인식 리마인더 크론 작업 — Half-Hourly Sweep 패턴
 *
 * 매 30분마다 실행되어 각 타임존별 로컬 시간(시+분)을 확인하고,
 * 해당 시간에 아침/저녁 리마인더를 원하는 사용자에게 알림을 발송합니다.
 *
 * 기존 MorningReminderJob + EveningReminderJob을 통합 대체합니다.
 */
@Injectable()
export class TimezoneAwareReminderJob {
	readonly #logger = new Logger(TimezoneAwareReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 매 30분마다 실행 — Half-Hourly Sweep 패턴
	 *
	 * 1. DB에서 활성화된 고유 타임존 목록 조회 (1 query)
	 * 2. 각 타임존의 현재 로컬 시간(시+분) 확인
	 * 3. 해당 시간에 아침/저녁 리마인더를 원하는 사용자에게 발송
	 */
	@Cron("0,30 * * * *")
	async handleHourlySweep(): Promise<void> {
		this.#logger.log("Starting half-hourly sweep reminder job...");

		const release = await this.lockProvider.acquire(
			"timezone-reminder",
			25 * 60 * 1000,
		);

		if (!release) {
			this.#logger.warn("Skipping sweep — another instance holds the lock");
			return;
		}

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
				const localMinute = local.minute() >= 30 ? 30 : 0;
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

			this.#logger.log("Half-hourly sweep reminder job completed");
		} catch (error) {
			this.#logger.error(
				`Sweep reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	/**
	 * 리마인더 시간 변경 이벤트 핸들러 — Catch-up 패턴
	 *
	 * 사용자가 리마인더 시간을 변경했을 때, 변경된 시간이 현재 로컬 시간과
	 * 같으면 즉시 리마인더를 발송합니다. (크론이 이미 실행된 후 변경한 경우 보완)
	 *
	 * 중복 방지: `notificationDate` 기반이므로 크론에서 이미 발송했으면 스킵됩니다.
	 */
	@OnEvent(NotificationEvents.REMINDER_HOUR_CHANGED)
	async handleReminderHourChanged(
		payload: ReminderHourChangedEventPayload,
	): Promise<void> {
		try {
			const now = dayjs().tz(payload.timezone);
			const localHour = now.hour();
			const localMinute = now.minute() >= 30 ? 30 : 0;

			if (
				payload.morningReminderHour !== undefined &&
				payload.morningReminderHour === localHour &&
				(payload.morningReminderMinute ?? 0) === localMinute
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

			if (
				payload.eveningReminderHour !== undefined &&
				payload.eveningReminderHour === localHour &&
				(payload.eveningReminderMinute ?? 0) === localMinute
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

	async #processTimezone(
		tz: string,
		localHour: number,
		localMinute: number,
	): Promise<void> {
		await this.#sendMorningReminders(tz, localHour, localMinute);
		await this.#sendEveningReminders(tz, localHour, localMinute);
	}

	async #sendMorningReminders(
		tz: string,
		localHour: number,
		localMinute: number,
		userId?: string,
	): Promise<void> {
		const today = getUserToday(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const users = await this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				pushTokens: {
					some: {},
				},
				OR: [{ subscriptionStatus: "ACTIVE" }, { role: "ADMIN" }],
				preference: {
					timezone: tz,
					pushEnabled: true,
					morningReminderHour: localHour,
					morningReminderMinute: localMinute,
				},
			},
			select: {
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
			},
		});

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
	): Promise<void> {
		const today = getUserToday(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const users = await this.database.user.findMany({
			where: {
				...(userId && { id: userId }),
				pushTokens: {
					some: {},
				},
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
			select: {
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
			},
		});

		if (users.length === 0) return;

		// 중복 방지: 이미 오늘 저녁 리마인더를 받은 사용자 제외
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "EVENING_REMINDER",
				notificationDate: today,
			});

		const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));
		if (filteredUsers.length === 0) return;

		const notifications = filteredUsers.map((user) => {
			const total = user.todos.length;
			const completed = user.todos.filter((t) => t.completed).length;
			const message = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
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
	}
}
