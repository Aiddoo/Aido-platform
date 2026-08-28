import { Inject, Injectable, Logger } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";

import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	NOTIFICATION_JOB_POLICY,
	NOTIFICATION_QUEUE,
	NotificationJobName,
	type NotificationRuntimeJob,
	type NudgeSentJobData,
} from "./notification-queue.constants";

@Injectable()
export class NotificationQueueService {
	readonly #logger = new Logger(NotificationQueueService.name);

	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	/**
	 * 새 팔로우 요청 알림 잡 등록
	 */
	enqueueFollowNew(payload: FollowNewJobData): void {
		this.#enqueueAsync({ name: NotificationJobName.FOLLOW_NEW, data: payload }).catch((error) => {
			this.#logger.error(
				`Failed to enqueue follow-new: followerId=${payload.followerId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * 맞팔로우 성립 알림 잡 등록
	 */
	enqueueFollowMutual(payload: FollowMutualJobData): void {
		this.#enqueueAsync({ name: NotificationJobName.FOLLOW_MUTUAL, data: payload }).catch(
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
		this.#enqueueAsync({ name: NotificationJobName.NUDGE_SENT, data: payload }).catch((error) => {
			this.#logger.error(
				`Failed to enqueue nudge-sent: nudgeId=${payload.nudgeId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * Cheer 발송 알림 잡 등록
	 */
	enqueueCheerSent(payload: CheerSentJobData): void {
		this.#enqueueAsync({ name: NotificationJobName.CHEER_SENT, data: payload }).catch((error) => {
			this.#logger.error(
				`Failed to enqueue cheer-sent: cheerId=${payload.cheerId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * 결제 문제 알림 잡 등록
	 */
	enqueueBillingIssue(payload: BillingIssueJobData): void {
		this.#enqueueAsync({ name: NotificationJobName.BILLING_ISSUE, data: payload }).catch(
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
		this.#enqueueAsync({ name: NotificationJobName.FRIEND_COMPLETED, data: payload }).catch(
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
		this.#enqueueAsync({ name: NotificationJobName.MILESTONE_REACHED, data: payload }).catch(
			(error) => {
				this.#logger.error(
					`Failed to enqueue milestone-reached: userId=${payload.userId}, milestone=${payload.milestone}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	async #enqueueAsync(
		job: Exclude<NotificationRuntimeJob, { name: typeof NotificationJobName.PUSH_RECEIPTS }>,
	): Promise<void> {
		await this.runtime.enqueue(NOTIFICATION_QUEUE, job, this.#jobOptions());
		this.#logger.debug(`Job enqueued: name=${job.name}`);
	}

	#jobOptions() {
		return NOTIFICATION_JOB_POLICY;
	}
}
