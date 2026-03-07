import { USER_PREFERENCE_DEFAULTS } from "@aido/validators";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import dayjs from "dayjs";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import {
	type ReminderHourChangedJobData,
	TIMEZONE_REMINDER_QUEUE,
	type TimezoneReminderJobData,
	TimezoneReminderProcessor,
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
		@InjectQueue(TIMEZONE_REMINDER_QUEUE)
		private readonly queue: Queue<TimezoneReminderJobData>,
		private readonly processor: TimezoneReminderProcessor,
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setReminderJob(this);

		await this.queue.upsertJobScheduler(
			"tz-reminder-sweep-scheduler",
			{ pattern: "* * * * *" },
			{ name: "sweep-reminders", data: {} },
		);

		this.#logger.log("Timezone reminder scheduler registered");
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
	): Promise<void> {
		const today = todayInTimezone(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

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
