import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";

dayjs.extend(utc);

/**
 * 아침 리마인더 크론 작업
 *
 * 매일 아침 08:00에 실행되어 푸시 토큰이 있는 모든 사용자에게 알림을 발송합니다.
 * 할일이 있는 사용자에게는 할일 개수를, 없는 사용자에게는 앱 접속 유도 메시지를 보냅니다.
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
			// 오늘 날짜 범위 계산 (UTC 기준으로 일관성 보장)
			const today = dayjs.utc().startOf("day").toDate();
			const tomorrow = dayjs.utc().add(1, "day").startOf("day").toDate();

			// 푸시 토큰이 있는 모든 사용자 조회 (할일 유무 관계없이)
			const usersWithTodos = await this.database.user.findMany({
				where: {
					pushTokens: {
						some: {},
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
				this.logger.log("No users with push tokens for morning reminder");
				return;
			}

			// 각 사용자에게 알림 생성 및 발송 (할일 유무에 따라 메시지 분기)
			const notifications = usersWithTodos.map((user) => {
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
