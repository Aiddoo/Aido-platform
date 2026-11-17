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
    return this.#queue.enqueueFollowNew({
      followerId: payload.followerId.value,
      followingId: payload.followingId.value,
      followerName: payload.followerName,
    });
  }

  notifyFollowMutual(payload: FollowMutualNotification): Promise<void> {
    return this.#queue.enqueueFollowMutual({
      userId: payload.userId.value,
      friendId: payload.friendId.value,
      friendName: payload.friendName,
    });
  }

  notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): Promise<void> {
    return this.#queue.enqueueMilestoneReached({
      userId: payload.userId.value,
      milestone: "FIRST_FRIEND",
    });
  }
}
