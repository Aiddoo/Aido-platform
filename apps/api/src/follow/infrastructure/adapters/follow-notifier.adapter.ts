import { Injectable } from "@nestjs/common";

import { NotificationQueueService } from "@/notification";

import type {
	FirstFriendMilestoneNotification,
	FollowMutualNotification,
	FollowNewNotification,
	FollowNotifierPort,
} from "../../application/ports/follow-notifier.port";

/**
 * FollowNotifierPort의 어댑터 — 레거시 NotificationQueueService(BullMQ)에 위임한다.
 * notification 모듈이 클린아키텍처로 이관되면 이 어댑터 내부만 교체하면 된다.
 */
@Injectable()
export class FollowNotifierAdapter implements FollowNotifierPort {
	constructor(private readonly queue: NotificationQueueService) {}

	notifyFollowNew(payload: FollowNewNotification): void {
		this.queue.enqueueFollowNew(payload);
	}

	notifyFollowMutual(payload: FollowMutualNotification): void {
		this.queue.enqueueFollowMutual(payload);
	}

	notifyFirstFriendMilestone(payload: FirstFriendMilestoneNotification): void {
		this.queue.enqueueMilestoneReached({
			userId: payload.userId,
			milestone: "FIRST_FRIEND",
		});
	}
}
