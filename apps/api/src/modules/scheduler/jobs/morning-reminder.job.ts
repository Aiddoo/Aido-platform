import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";

/**
 * 아침 리마인더 크론 작업
 *
 * 매일 아침 08:00에 실행되어 오늘 할일이 있는 사용자에게 알림을 발송합니다.
 */
@Injectable()
export class MorningReminderJob {
	private readonly logger = new Logger(MorningReminderJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * 매일 08:00에 실행
	 */
	@Cron(CronExpression.EVERY_DAY_AT_8AM)
	async handleMorningReminder(): Promise<void> {
		this.logger.log("Starting morning reminder job...");

		try {
			// 오늘 날짜 범위 계산
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			// 오늘 할일이 있는 사용자 조회 (푸시 토큰이 있는 사용자만)
			const usersWithTodos = await this.database.user.findMany({
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

			if (usersWithTodos.length === 0) {
				this.logger.log("No users with todos for morning reminder");
				return;
			}

			// 각 사용자에게 알림 생성 및 발송
			const notifications = usersWithTodos.map((user) => {
				const message = NotificationMessageBuilder.morningReminder(
					user._count.todos,
				);

				return {
					userId: user.id,
					type: "MORNING_REMINDER" as const,
					title: message.title,
					body: message.body,
					route: "/",
				};
			});

			await this.notificationService.createAndSendBatch(notifications);

			this.logger.log(
				`Morning reminder sent to ${usersWithTodos.length} users`,
			);
		} catch (error) {
			this.logger.error(
				`Morning reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
