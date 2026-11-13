import { Injectable } from "@nestjs/common";

import { NotificationQueueAdapter } from "#api/modules/notification/notification-delivery-jobs.public";

import type {
  FirstFriendMilestoneNotification,
  FollowMutualNotification,
  FollowNewNotification,
  FriendshipNotifierPort,
} from "../../application/ports/friendship-notifier.port.js";

@Injectable()
export class FriendshipNotifierAdapter implements FriendshipNotifierPort {
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
