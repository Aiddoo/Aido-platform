import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { REMINDER_LEAD_TIME_MS } from "../constants/reminder.constants";

/**
 * 할일 마감 리마인더 크론 작업
 *
 * 10분마다 실행되어 마감 1시간 전인 할일에 대해 알림을 발송합니다.
 * scheduledTime이 설정된 할일만 대상이 됩니다.
 * DB 기반으로 중복 알림을 방지합니다 (24시간 내 동일 TODO_REMINDER 존재 여부).
 */
@Injectable()
export class TodoReminderJob {
	private readonly logger = new Logger(TodoReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 10분마다 실행
	 * 마감 50분~60분 전인 할일을 찾아 알림을 발송합니다.
	 */
	@Cron("*/10 * * * *")
	async handleTodoReminder(): Promise<void> {
		this.logger.log("Starting todo reminder job...");

		const release = await this.lockProvider.acquire(
			"todo-reminder",
			9 * 60 * 1000,
		);

		if (!release) {
			this.logger.warn(
				"Skipping todo reminder — another instance holds the lock",
			);
			return;
		}

		try {
			await this.execute();
		} catch (error) {
			this.logger.error(
				`Todo reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	private async execute(): Promise<void> {
		const now = new Date();
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		// LEAD_TIME 시점 계산 (10분 간격 실행에 맞춤: LEAD_TIME-10분 ~ LEAD_TIME)
		const cronIntervalMs = 10 * 60 * 1000;
		const reminderStart = new Date(
			now.getTime() + REMINDER_LEAD_TIME_MS - cronIntervalMs,
		);
		const reminderEnd = new Date(now.getTime() + REMINDER_LEAD_TIME_MS);

		// 마감이 50분~60분 후인 할일 조회
		// - scheduledTime이 설정되어 있고
		// - 완료되지 않았고
		// - 푸시 토큰이 있는 사용자의 할일
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
			this.logger.log("No todos to notify for reminder");
			return;
		}

		// 이미 알림을 보낸 할일 제외 (DB 기반 중복 방지)
		const todoIds = todosToNotify.map((todo) => todo.id);
		const existingNotifications = await this.database.notification.findMany({
			where: {
				todoId: { in: todoIds },
				type: "TODO_REMINDER",
				createdAt: { gte: twentyFourHoursAgo },
			},
			select: { todoId: true },
		});

		const alreadyNotifiedIds = new Set(
			existingNotifications.map((n) => n.todoId),
		);
		const newTodosToNotify = todosToNotify.filter(
			(todo) => !alreadyNotifiedIds.has(todo.id),
		);

		if (newTodosToNotify.length === 0) {
			this.logger.log("No todos to notify for reminder");
			return;
		}

		// 각 할일에 대해 알림 생성 및 발송
		const notifications = newTodosToNotify.map((todo) => {
			const message = NotificationMessageBuilder.todoReminder(todo.title);

			return {
				userId: todo.userId,
				type: "TODO_REMINDER" as const,
				title: message.title,
				body: message.body,
				todoId: todo.id,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);

		this.logger.log(`Todo reminder sent for ${newTodosToNotify.length} todos`);
	}
}
