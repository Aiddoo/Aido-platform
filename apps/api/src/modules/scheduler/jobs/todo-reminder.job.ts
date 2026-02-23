import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { REMINDER_STAGES } from "../constants/reminder.constants";

/**
 * 할일 마감 리마인더 크론 작업 (폴백)
 *
 * 10분마다 실행되어 각 리마인더 단계(60분 전, 10분 전)에 해당하는 할일을 찾아 알림을 발송합니다.
 * InMemoryReminderSchedulerAdapter의 이중 안전장치 역할을 합니다.
 * DB 기반으로 단계별 중복 알림을 방지합니다 (metadata.stage 매칭).
 */
@Injectable()
export class TodoReminderJob {
	readonly #logger = new Logger(TodoReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 10분마다 실행
	 * 각 단계별로 해당 시간 범위의 할일을 찾아 알림을 발송합니다.
	 */
	@Cron("*/10 * * * *")
	async handleTodoReminder(): Promise<void> {
		this.#logger.log("Starting todo reminder job...");

		const release = await this.lockProvider.acquire(
			"todo-reminder",
			9 * 60 * 1000,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping todo reminder — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#execute();
		} catch (error) {
			this.#logger.error(
				`Todo reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	async #execute(): Promise<void> {
		const now = new Date();
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const cronIntervalMs = 10 * 60 * 1000;

		for (const stage of REMINDER_STAGES) {
			try {
				// 이 단계의 스캔 윈도우: [now + leadTime - 10분, now + leadTime)
				const reminderStart = new Date(
					now.getTime() + stage.leadTimeMs - cronIntervalMs,
				);
				const reminderEnd = new Date(now.getTime() + stage.leadTimeMs);

				const todosToNotify = await this.database.todo.findMany({
					where: {
						scheduledTime: {
							gte: reminderStart,
							lt: reminderEnd,
						},
						completed: false,
						user: {
							pushTokens: {
								some: {},
							},
						},
					},
					select: {
						id: true,
						title: true,
						userId: true,
					},
				});

				if (todosToNotify.length === 0) {
					continue;
				}

				// 이미 알림을 보낸 할일 제외 (단계별 DB 중복 방지)
				const todoIds = todosToNotify.map((todo) => todo.id);
				const existingNotifications = await this.database.notification.findMany(
					{
						where: {
							todoId: { in: todoIds },
							type: "TODO_REMINDER",
							createdAt: { gte: twentyFourHoursAgo },
							metadata: {
								path: ["stage"],
								equals: stage.label,
							},
						},
						select: { todoId: true },
					},
				);

				const alreadyNotifiedIds = new Set(
					existingNotifications.map((n) => n.todoId),
				);
				const newTodosToNotify = todosToNotify.filter(
					(todo) => !alreadyNotifiedIds.has(todo.id),
				);

				if (newTodosToNotify.length === 0) {
					continue;
				}

				const notifications = newTodosToNotify.map((todo) => {
					const message = NotificationMessageBuilder.todoReminder(
						todo.title,
						stage.label,
					);

					return {
						userId: todo.userId,
						type: "TODO_REMINDER" as const,
						title: message.title,
						body: message.body,
						todoId: todo.id,
						metadata: { stage: stage.label },
					};
				});

				await this.notificationService.createAndSendBatch(notifications);

				this.#logger.log(
					`Todo reminder (${stage.label}) sent for ${newTodosToNotify.length} todos`,
				);
			} catch (error) {
				this.#logger.error(
					`Todo reminder stage "${stage.label}" failed: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}
}
