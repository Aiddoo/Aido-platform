import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  FirstFriendMilestoneNotification,
  FollowMutualNotification,
  FollowNewNotification,
  FollowNotifierPort,
} from "../../application/ports/follow-notifier.port.js";

@Injectable()
export class FollowNotifierAdapter implements FollowNotifierPort {
  readonly #queue: NotificationQueueAdapter;

  constructor(queue: NotificationQueueAdapter) {
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
