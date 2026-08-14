import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "@/notification/queue";

import type { StreakMilestoneNotifierPort } from "../../application/ports/streak-milestone.notifier.port";

/**
 * 스트릭 마일스톤 알림 어댑터.
 *
 * notification의 큐 발송 심(`@/notification/queue`)으로 위임한다.
 * heavy 배럴을 피해 ES 초기화 순환을 방지한다.
 */
@Injectable()
export class StreakMilestoneNotifierAdapter implements StreakMilestoneNotifierPort {
	constructor(private readonly notificationQueueService: NotificationQueueService) {}

	notifyStreak3Reached(userId: string): void {
		this.notificationQueueService.enqueueMilestoneReached({
			userId,
			milestone: "STREAK_3",
		});
	}
}
