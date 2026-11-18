import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notifications/notification-notifications-jobs.public";

import type {
  FriendCompletedPayload,
  MilestoneReachedPayload,
  TodoNotificationPort,
} from "../../application/ports/todo-notification.port.js";

// 포트 페이로드의 id VO를 notification 작업 데이터의 원시값으로 바꿔 넘긴다
@Injectable()
export class TodoNotificationAdapter implements TodoNotificationPort {
  readonly #notificationQueueService: NotificationQueueAdapter;

  constructor(notificationQueueService: NotificationQueueAdapter) {
    this.#notificationQueueService = notificationQueueService;
  }

  enqueueFriendCompleted(payload: FriendCompletedPayload): Promise<void> {
    return this.#notificationQueueService.enqueueFriendCompleted({
      friendId: payload.friendId.value,
      friendName: payload.friendName,
      notifyUserIds: payload.notifyUserIds.map((userId) => userId.value),
      timezone: payload.timezone,
    });
  }

  enqueueMilestoneReached(payload: MilestoneReachedPayload): Promise<void> {
    return this.#notificationQueueService.enqueueMilestoneReached({
      userId: payload.userId.value,
      milestone: payload.milestone,
    });
  }
}
