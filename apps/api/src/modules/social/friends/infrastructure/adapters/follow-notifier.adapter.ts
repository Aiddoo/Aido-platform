import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  FirstFriendMilestoneNotification,
  FollowMutualNotification,
  FollowNewNotification,
  FollowNotifierPort,
} from "../../application/ports/follow-notifier.port.js";

@Injectable()
export class FollowNotifierAdapter implements FollowNotifierPort {
  readonly #queue: NotificationQueueService;

  constructor(queue: NotificationQueueService) {
    this.#queue = queue;
  }

  notifyFollowNew(payload: FollowNewNotification): void {
    this.#queue.enqueueFollowNew(payload);
  }

  notifyFollowMutual(payload: FollowMutualNotification): void {
    this.#queue.enqueueFollowMutual(payload);
  }

  notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): void {
    this.#queue.enqueueMilestoneReached({ userId: payload.userId, milestone: "FIRST_FRIEND" });
  }
}
