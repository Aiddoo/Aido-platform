import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";

import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";
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
	type TodoAllCompletedJobData,
} from "./notification-queue.constants";

// =============================================================================
// Processor
// =============================================================================

/**
 * Notification BullMQ Processor
 *
 * 큐에 등록된 알림 잡을 처리합니다.
 * - follow-new: 새 팔로우 요청 알림
 * - follow-mutual: 맞팔로우 성립 알림
 * - nudge-sent: 콕 찌르기 수신 알림
 * - cheer-sent: 응원 수신 알림
 * - billing-issue: 결제 문제 알림 (재시도 대상)
 *
 * 소셜 알림(follow, nudge, cheer)은 실패 시 로깅만 수행합니다.
 * 결제 알림(billing-issue)은 실패 시 re-throw하여 BullMQ 재시도를 활용합니다.
 *
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationQueueProcessor extends WorkerHost {
	readonly #logger = new Logger(NotificationQueueProcessor.name);

	constructor(
		private readonly notificationService: NotificationService,
		private readonly database: DatabaseService,
	) {
		super();
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: Job<NotificationJobData>): Promise<void> {
		switch (job.name) {
			case NotificationJobName.FOLLOW_NEW:
				await this.#handleFollowNew(job.data as FollowNewJobData);
				break;
			case NotificationJobName.FOLLOW_MUTUAL:
				await this.#handleFollowMutual(job.data as FollowMutualJobData);
				break;
			case NotificationJobName.NUDGE_SENT:
				await this.#handleNudgeSent(job.data as NudgeSentJobData);
				break;
			case NotificationJobName.CHEER_SENT:
				await this.#handleCheerSent(job.data as CheerSentJobData);
				break;
			case NotificationJobName.BILLING_ISSUE:
				await this.#handleBillingIssue(job.data as BillingIssueJobData);
				break;
			case NotificationJobName.TODO_ALL_COMPLETED:
				await this.#handleTodoAllCompleted(job.data as TodoAllCompletedJobData);
				break;
			case NotificationJobName.FRIEND_COMPLETED:
				await this.#handleFriendCompleted(job.data as FriendCompletedJobData);
				break;
			default:
				this.#logger.warn(`Unknown job name: ${job.name}`);
		}
	}

	// =========================================================================
	// Job Handlers
	// =========================================================================

	async #handleFollowNew(data: FollowNewJobData): Promise<void> {
		try {
			const message = NotificationMessageBuilder.followNew(data.followerName);

			await this.notificationService.createAndSendWithDedup({
				userId: data.followingId,
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				friendId: data.followerId,
			});

			this.#logger.log(
				`Follow request notification sent to user: ${data.followingId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send follow request notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #handleFollowMutual(data: FollowMutualJobData): Promise<void> {
		try {
			const message = NotificationMessageBuilder.followAccepted(
				data.friendName,
			);

			await this.notificationService.createAndSendWithDedup({
				userId: data.userId,
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				friendId: data.friendId,
			});

			this.#logger.log(
				`Mutual follow notification sent to user: ${data.userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send mutual follow notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #handleNudgeSent(data: NudgeSentJobData): Promise<void> {
		try {
			const message = NotificationMessageBuilder.nudgeReceived(
				data.senderName,
				data.message,
			);

			await this.notificationService.createAndSendWithDedup({
				userId: data.receiverId,
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				nudgeId: data.nudgeId,
				friendId: data.senderId,
				todoId: data.todoId,
				metadata: data.message ? { message: data.message } : undefined,
			});

			this.#logger.log(
				`Nudge notification sent: from=${data.senderId}, to=${data.receiverId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send nudge notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #handleCheerSent(data: CheerSentJobData): Promise<void> {
		try {
			const message = NotificationMessageBuilder.cheerReceived(
				data.senderName,
				data.message,
			);

			await this.notificationService.createAndSendWithDedup({
				userId: data.receiverId,
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: data.cheerId,
				friendId: data.senderId,
				metadata: data.message ? { message: data.message } : undefined,
			});

			this.#logger.log(
				`Cheer notification sent: from=${data.senderId}, to=${data.receiverId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send cheer notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #handleBillingIssue(data: BillingIssueJobData): Promise<void> {
		try {
			const message = NotificationMessageBuilder.billingIssue();

			await this.notificationService.createAndSend({
				userId: data.userId,
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});

			this.#logger.log(
				`Billing issue notification sent: userId=${data.userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send billing issue notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			// 결제 알림은 재시도 대상 — BullMQ retry 활용
			throw error;
		}
	}

	async #handleTodoAllCompleted(data: TodoAllCompletedJobData): Promise<void> {
		try {
			const today = todayInTimezone(data.timezone);

			await this.database.$transaction(async (tx) => {
				const alreadySent = await this.notificationService.existsNotification(
					{
						userId: data.userId,
						type: "DAILY_COMPLETE",
						notificationDate: today,
					},
					tx,
				);

				if (alreadySent) {
					this.#logger.debug(
						`Daily completion already sent today: userId=${data.userId}`,
					);
					return;
				}

				const message = NotificationMessageBuilder.dailyComplete(
					data.completedCount,
				);

				await this.notificationService.createAndSend(
					{
						userId: data.userId,
						type: "DAILY_COMPLETE",
						title: message.title,
						body: message.body,
						notificationDate: today,
					},
					tx,
				);

				this.#logger.log(
					`Daily completion notification sent to user: ${data.userId}`,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.#logger.debug(
					`Daily completion duplicate prevented by constraint: userId=${data.userId}`,
				);
				return;
			}

			this.#logger.error(
				`Failed to send daily completion notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #handleFriendCompleted(data: FriendCompletedJobData): Promise<void> {
		if (data.notifyUserIds.length === 0) {
			this.#logger.debug("No friends to notify for friend completion");
			return;
		}

		try {
			const today = todayInTimezone(data.timezone);

			await this.database.$transaction(async (tx) => {
				const alreadyNotified =
					await this.notificationService.findAlreadyNotifiedUserIds(
						{
							userIds: data.notifyUserIds,
							type: "FRIEND_COMPLETED",
							notificationDate: today,
							friendId: data.friendId,
						},
						tx,
					);

				const newUserIds = data.notifyUserIds.filter(
					(id) => !alreadyNotified.has(id),
				);

				if (newUserIds.length === 0) {
					this.#logger.debug(
						`Friend completion already sent today: friendId=${data.friendId}`,
					);
					return;
				}

				const message = NotificationMessageBuilder.friendCompleted(
					data.friendName,
				);

				const notifications = newUserIds.map((userId) => ({
					userId,
					type: "FRIEND_COMPLETED" as const,
					title: message.title,
					body: message.body,
					friendId: data.friendId,
					notificationDate: today,
				}));

				await this.notificationService.createAndSendBatch(notifications, tx);

				this.#logger.log(
					`Friend completion notifications sent: friendId=${data.friendId}, count=${newUserIds.length}`,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.#logger.debug(
					`Friend completion duplicate prevented by constraint: friendId=${data.friendId}`,
				);
				return;
			}

			this.#logger.error(
				`Failed to send friend completion notifications: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
