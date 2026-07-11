import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "@/notification/queue/notification-queue.service";

import type { StreakMilestoneNotifierPort } from "../../application/ports/streak-milestone.notifier.port";

/**
 * 스트릭 마일스톤 알림 어댑터.
 *
 * notification의 NotificationQueueService로 위임한다(미이관 모듈 — 딥 임포트).
 */
@Injectable()
export class StreakMilestoneNotifierAdapter
	implements StreakMilestoneNotifierPort
{
	constructor(
		private readonly notificationQueueService: NotificationQueueService,
	) {}

	notifyStreak3Reached(userId: string): void {
		this.notificationQueueService.enqueueMilestoneReached({
			userId,
			milestone: "STREAK_3",
		});
	}
}
