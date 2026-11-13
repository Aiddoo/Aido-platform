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

  notifyFollowNew(payload: FollowNewNotification): Promise<void> {
    return this.#queue.enqueueFollowNew(payload);
  }

  notifyFollowMutual(payload: FollowMutualNotification): Promise<void> {
    return this.#queue.enqueueFollowMutual(payload);
  }

  notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): Promise<void> {
    return this.#queue.enqueueMilestoneReached({
      userId: payload.userId,
      milestone: "FIRST_FRIEND",
    });
  }
}
