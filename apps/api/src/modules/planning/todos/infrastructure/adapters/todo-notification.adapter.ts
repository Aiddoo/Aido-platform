import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  FriendCompletedPayload,
  MilestoneReachedPayload,
  TodoNotificationPort,
} from "../../application/ports/todo-notification.port.js";

/**
 * Todo 알림 포트 어댑터 — NotificationQueueService에 위임
 *
 * 포트 소유 페이로드는 notification의 JobData와 구조 호환이라 그대로 전달합니다.
 */
@Injectable()
export class TodoNotificationAdapter implements TodoNotificationPort {
  readonly #notificationQueueService: NotificationQueueService;

  constructor(notificationQueueService: NotificationQueueService) {
    this.#notificationQueueService = notificationQueueService;
  }

  enqueueFriendCompleted(payload: FriendCompletedPayload): void {
    this.#notificationQueueService.enqueueFriendCompleted(payload);
  }

  enqueueMilestoneReached(payload: MilestoneReachedPayload): void {
    this.#notificationQueueService.enqueueMilestoneReached(payload);
  }
}
