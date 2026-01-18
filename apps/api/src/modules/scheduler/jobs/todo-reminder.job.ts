import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";

/**
 * 할일 마감 리마인더 크론 작업
 *
 * 10분마다 실행되어 마감 1시간 전인 할일에 대해 알림을 발송합니다.
 * scheduledTime이 설정된 할일만 대상이 됩니다.
 */
@Injectable()
export class TodoReminderJob {
	private readonly logger = new Logger(TodoReminderJob.name);

	/**
	 * 이미 알림을 보낸 할일 ID를 추적 (메모리 캐시)
	 * 서버 재시작 시 초기화되므로, 프로덕션에서는 Redis 등을 사용하는 것이 좋습니다.
	 */
	private readonly notifiedTodoIds = new Set<number>();

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * 10분마다 실행
	 * 마감 50분~60분 전인 할일을 찾아 알림을 발송합니다.
	 */
	@Cron("*/10 * * * *")
	async handleTodoReminder(): Promise<void> {
		this.logger.log("Starting todo reminder job...");

		try {
			const now = new Date();

			// 1시간 후 시점 계산 (50분~60분 범위로 10분 간격 실행에 맞춤)
			const reminderStart = new Date(now.getTime() + 50 * 60 * 1000); // 50분 후
			const reminderEnd = new Date(now.getTime() + 60 * 60 * 1000); // 60분 후

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

			// 이미 알림을 보낸 할일 제외
			const newTodosToNotify = todosToNotify.filter(
				(todo) => !this.notifiedTodoIds.has(todo.id),
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
					route: `/todos/${todo.id}`,
					todoId: todo.id,
				};
			});

			await this.notificationService.createAndSendBatch(notifications);

			// 알림을 보낸 할일 ID 기록
			for (const todo of newTodosToNotify) {
				this.notifiedTodoIds.add(todo.id);
			}

			// 오래된 캐시 정리 (24시간 이상 된 항목은 제거)
			// 실제로는 Redis TTL을 사용하는 것이 좋습니다.
			this.cleanupOldCache();

			this.logger.log(
				`Todo reminder sent for ${newTodosToNotify.length} todos`,
			);
		} catch (error) {
			this.logger.error(
				`Todo reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 오래된 캐시 정리
	 * 캐시 크기가 1000개를 초과하면 절반을 제거합니다.
	 */
	private cleanupOldCache(): void {
		if (this.notifiedTodoIds.size > 1000) {
			const idsArray = Array.from(this.notifiedTodoIds);
			const toRemove = idsArray.slice(0, 500);
			for (const id of toRemove) {
				this.notifiedTodoIds.delete(id);
			}
			this.logger.log(
				`Cleaned up ${toRemove.length} old todo reminder cache entries`,
			);
		}
	}
}
