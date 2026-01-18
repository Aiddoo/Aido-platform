import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";

/**
 * 저녁 리마인더 크론 작업
 *
 * 매일 저녁 18:00에 실행되어 사용자에게 오늘 할일 완료 현황 알림을 발송합니다.
 * 완료 현황에 따라 다른 메시지를 발송합니다.
 */
@Injectable()
export class EveningReminderJob {
	private readonly logger = new Logger(EveningReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * 매일 18:00에 실행
	 */
	@Cron(CronExpression.EVERY_DAY_AT_6PM)
	async handleEveningReminder(): Promise<void> {
		this.logger.log("Starting evening reminder job...");

		try {
			// 오늘 날짜 범위 계산
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			// 푸시 토큰이 있는 사용자 중 오늘 할일이 있는 사용자 조회
			const usersWithTodoStats = await this.database.user.findMany({
				where: {
					pushTokens: {
						some: {},
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

			if (usersWithTodoStats.length === 0) {
				this.logger.log("No users with todos for evening reminder");
				return;
			}

			// 각 사용자에게 알림 생성 및 발송
			const notifications = usersWithTodoStats.map((user) => {
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
					route: "/",
				};
			});

			await this.notificationService.createAndSendBatch(notifications);

			this.logger.log(
				`Evening reminder sent to ${usersWithTodoStats.length} users`,
			);
		} catch (error) {
			this.logger.error(
				`Evening reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
