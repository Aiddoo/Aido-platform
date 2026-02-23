import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getUserToday } from "@/common/date/utils/date.util";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 타임존 인식 리마인더 크론 작업 — Hourly Sweep 패턴
 *
 * 매시간 정각에 실행되어 각 타임존별 로컬 시간을 확인하고,
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
	 * 매시간 정각 실행 — Hourly Sweep 패턴
	 *
	 * 1. DB에서 활성화된 고유 타임존 목록 조회 (1 query)
	 * 2. 각 타임존의 현재 로컬 시간 확인
	 * 3. 해당 시간에 아침/저녁 리마인더를 원하는 사용자에게 발송
	 */
	@Cron("0 * * * *")
	async handleHourlySweep(): Promise<void> {
		this.#logger.log("Starting hourly sweep reminder job...");

		const release = await this.lockProvider.acquire(
			"timezone-reminder",
			55 * 60 * 1000,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping hourly sweep — another instance holds the lock",
			);
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

			for (const { timezone: tz } of timezones) {
				const localHour = dayjs(now).tz(tz).hour();

				// 2. 아침 리마인더: morningReminderHour가 현재 시간인 사용자
				try {
					await this.#sendMorningReminders(tz, localHour);
				} catch (error) {
					this.#logger.error(
						`Morning reminder failed for tz=${tz}: ${error}`,
						error instanceof Error ? error.stack : undefined,
					);
				}

				// 3. 저녁 리마인더: eveningReminderHour가 현재 시간인 사용자
				try {
					await this.#sendEveningReminders(tz, localHour);
				} catch (error) {
					this.#logger.error(
						`Evening reminder failed for tz=${tz}: ${error}`,
						error instanceof Error ? error.stack : undefined,
					);
				}
			}

			this.#logger.log("Hourly sweep reminder job completed");
		} catch (error) {
			this.#logger.error(
				`Hourly sweep reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	async #sendMorningReminders(tz: string, localHour: number): Promise<void> {
		const today = getUserToday(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const users = await this.database.user.findMany({
			where: {
				pushTokens: {
					some: {},
				},
				preference: {
					timezone: tz,
					pushEnabled: true,
					morningReminderHour: localHour,
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
			`Morning reminder: tz=${tz}, hour=${localHour}, count=${notifications.length}`,
		);
	}

	async #sendEveningReminders(tz: string, localHour: number): Promise<void> {
		const today = getUserToday(tz);
		const tomorrow = dayjs.utc(today).add(1, "day").toDate();

		const users = await this.database.user.findMany({
			where: {
				pushTokens: {
					some: {},
				},
				preference: {
					timezone: tz,
					pushEnabled: true,
					eveningReminderHour: localHour,
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
			`Evening reminder: tz=${tz}, hour=${localHour}, count=${notifications.length}`,
		);
	}
}
