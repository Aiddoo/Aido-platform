import { Injectable } from "@nestjs/common";
import type {
	FriendCompletedJobData,
	MilestoneReachedJobData,
} from "../../../notification/queue/notification-queue.constants";
import { NotificationQueueService } from "../../../notification/queue/notification-queue.service";
import type { TodoNotificationPort } from "../../application/ports/todo-notification.port";

/**
 * Todo 알림 포트 어댑터 — NotificationQueueService에 위임
 */
@Injectable()
export class TodoNotificationAdapter implements TodoNotificationPort {
	constructor(
		private readonly notificationQueueService: NotificationQueueService,
	) {}

	enqueueFriendCompleted(payload: FriendCompletedJobData): void {
		this.notificationQueueService.enqueueFriendCompleted(payload);
	}

	enqueueMilestoneReached(payload: MilestoneReachedJobData): void {
		this.notificationQueueService.enqueueMilestoneReached(payload);
	}
}
