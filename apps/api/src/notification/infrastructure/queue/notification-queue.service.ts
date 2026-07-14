import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	NOTIFICATION_QUEUE,
	type NotificationJobData,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";

@Injectable()
export class NotificationQueueService implements OnModuleInit {
	readonly #logger = new Logger(NotificationQueueService.name);

	constructor(
		@InjectQueue(NOTIFICATION_QUEUE)
		private readonly queue: Queue<NotificationJobData>,
	) {}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			"push-receipts-scheduler",
			{ every: 5 * 60 * 1000 },
			{
				name: NotificationJobName.PUSH_RECEIPTS,
				data: {},
				opts: { attempts: 5, backoff: { type: "exponential", delay: 2_000 } },
			},
		);
	}

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

	/**
	 * 마일스톤 달성 알림 잡 등록
	 */
	enqueueMilestoneReached(payload: MilestoneReachedJobData): void {
		this.#enqueueAsync(NotificationJobName.MILESTONE_REACHED, payload).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue milestone-reached: userId=${payload.userId}, milestone=${payload.milestone}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	async #enqueueAsync(name: string, data: NotificationJobData): Promise<void> {
		await this.queue.add(name, data, {
			attempts: 5,
			backoff: { type: "exponential", delay: 1_000 },
			removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
			removeOnFail: { age: 7 * 24 * 60 * 60, count: 50_000 },
		});
		this.#logger.debug(`Job enqueued: name=${name}`);
	}
}
