import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	NOTIFICATION_QUEUE,
	type NotificationJobData,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";

// =============================================================================
// Service
// =============================================================================

/**
 * Notification BullMQ 큐 서비스
 *
 * 각 모듈(Follow, Nudge, Cheer, Subscription)에서 호출하여
 * 알림 잡을 큐에 등록합니다. Fire-and-forget 패턴으로
 * 비동기 잡 등록 실패 시 로깅만 수행합니다.
 */
@Injectable()
export class NotificationQueueService {
	readonly #logger = new Logger(NotificationQueueService.name);

	constructor(
		@InjectQueue(NOTIFICATION_QUEUE)
		private readonly queue: Queue<NotificationJobData>,
	) {}

	/**
	 * 새 팔로우 요청 알림 잡 등록
	 */
	enqueueFollowNew(payload: FollowNewJobData): void {
		this.#enqueueAsync(NotificationJobName.FOLLOW_NEW, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue follow-new: followerId=${payload.followerId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * 맞팔로우 성립 알림 잡 등록
	 */
	enqueueFollowMutual(payload: FollowMutualJobData): void {
		this.#enqueueAsync(NotificationJobName.FOLLOW_MUTUAL, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue follow-mutual: userId=${payload.userId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * Nudge 발송 알림 잡 등록
	 */
	enqueueNudgeSent(payload: NudgeSentJobData): void {
		this.#enqueueAsync(NotificationJobName.NUDGE_SENT, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue nudge-sent: nudgeId=${payload.nudgeId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * Cheer 발송 알림 잡 등록
	 */
	enqueueCheerSent(payload: CheerSentJobData): void {
		this.#enqueueAsync(NotificationJobName.CHEER_SENT, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue cheer-sent: cheerId=${payload.cheerId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * 결제 문제 알림 잡 등록
	 */
	enqueueBillingIssue(payload: BillingIssueJobData): void {
		this.#enqueueAsync(NotificationJobName.BILLING_ISSUE, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue billing-issue: userId=${payload.userId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * 친구 할일 전체 완료 알림 잡 등록
	 */
	enqueueFriendCompleted(payload: FriendCompletedJobData): void {
		this.#enqueueAsync(NotificationJobName.FRIEND_COMPLETED, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue friend-completed: friendId=${payload.friendId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	// =========================================================================
	// Private
	// =========================================================================

	async #enqueueAsync(name: string, data: NotificationJobData): Promise<void> {
		await this.queue.add(name, data);
		this.#logger.debug(`Job enqueued: name=${name}`);
	}
}
