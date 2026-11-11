import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StreakMilestoneNotifierPort } from "../../application/ports/streak-milestone-notifier.port.js";

/**
 * 스트릭 마일스톤 알림 어댑터.
 *
 * notification의 큐 발송 심(`@/notification/queue`)으로 위임한다.
 * heavy 배럴을 피해 ES 초기화 순환을 방지한다.
 */
@Injectable()
export class StreakMilestoneNotifierAdapter implements StreakMilestoneNotifierPort {
  readonly #notificationQueueService: NotificationQueueAdapter;

  constructor(notificationQueueService: NotificationQueueAdapter) {
    this.#notificationQueueService = notificationQueueService;
  }

  notifyStreak3Reached(userId: UserId): void {
    this.#notificationQueueService.enqueueMilestoneReached({
      userId: userId.value,
      milestone: "STREAK_3",
    });
  }
}
